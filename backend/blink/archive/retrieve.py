"""ARCHIVE RETRIEVAL (archive -> storage). See blink/archive/__init__.py.

A RETRIEVAL PLAN is a JSON file the author writes (docs/DEPLOY_FULL.md, step 4):

    { "fieldId": "my-field", "sequenceId": "my-field-d2",
      "center": { "raDeg": 0.0, "decDeg": 0.0 }, "fovArcmin": 5,
      "files": [ { "sourceUrl": "https://irsa.ipac.caltech.edu/...", "fileName": "x.fits", "sha256": "<optional, hex>" } ] }

The URLs come from the author (e.g. found with IRSA TAP as 3.0 did); this module does not search the archive and does not invent URLs.
Rules: the sequence must be in the allow-list; https only, host in ARCHIVE_HOSTS; a size cap per file; when the plan gives a SHA-256 the file
must match it or it is NOT stored; the manifest records the SHA-256 and size of the stored bytes and whether the hash was checked against
the plan. Without `--confirm-download` the command only prints the plan (dry run).

    backend/.venv/bin/python -m blink.archive.retrieve --plan plan.json                       # dry run
    backend/.venv/bin/python -m blink.archive.retrieve --plan plan.json --confirm-download     # the author, after a yes
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from urllib.parse import urlparse

from ..approved import ID_RE, Approved, load_approved
from ..config import Settings
from ..store import DataStore, StoreError

ARCHIVE_HOSTS = ("irsa.ipac.caltech.edu",)
FILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.(fits|fits\.gz|fit)$")
MAX_FILE_MB = 1024
CHUNK = 1024 * 1024


class ArchiveError(Exception):
    """The archive did not deliver a file."""


class RetrievalError(ValueError):
    """The plan or a file is refused. The message says why."""


class Archive:
    def fetch(self, url: str) -> Iterator[bytes]:
        raise NotImplementedError


class HttpsArchive(Archive):
    """The real archive over https. Only the author's runs use it."""

    def __init__(self, hosts: tuple[str, ...] = ARCHIVE_HOSTS, timeout_s: float = 120):
        self.hosts, self.timeout_s = hosts, timeout_s

    def fetch(self, url: str) -> Iterator[bytes]:
        check_url(url, self.hosts)
        req = urllib.request.Request(url, headers={"User-Agent": "SPHEREx-Blink-4.0 retrieval"})
        try:
            resp = urllib.request.urlopen(req, timeout=self.timeout_s)  # noqa: S310 - https and host checked above
        except Exception as exc:  # noqa: BLE001
            raise ArchiveError(f"the archive did not answer ({exc.__class__.__name__})") from exc

        def chunks() -> Iterator[bytes]:
            with resp:
                while True:
                    block = resp.read(CHUNK)
                    if not block:
                        return
                    yield block

        return chunks()


class FakeArchive(Archive):
    """The archive of the tests: a dict url -> bytes. Records every fetch."""

    def __init__(self, files: dict[str, bytes]):
        self.files, self.fetched = dict(files), []

    def fetch(self, url: str) -> Iterator[bytes]:
        self.fetched.append(url)
        if url not in self.files:
            raise ArchiveError("the archive has no such file")
        data = self.files[url]
        return iter([data[i:i + CHUNK] for i in range(0, max(len(data), 1), CHUNK)])


def check_url(url: str, hosts: tuple[str, ...] = ARCHIVE_HOSTS) -> str:
    u = urlparse(url)
    if u.scheme != "https" or u.hostname not in hosts or u.username or u.password:
        raise RetrievalError(f"refused URL (https and one of {', '.join(hosts)} only): {url}")
    return url


def load_plan(path: Path) -> dict:
    try:
        plan = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RetrievalError(f"the plan cannot be read: {exc}") from exc
    return validate_plan(plan)


def validate_plan(plan: object, hosts: tuple[str, ...] = ARCHIVE_HOSTS) -> dict:
    if not isinstance(plan, dict):
        raise RetrievalError("the plan must be a JSON object")
    for k in ("fieldId", "sequenceId"):
        if not (isinstance(plan.get(k), str) and ID_RE.match(plan[k])):
            raise RetrievalError(f"the plan needs a URL-safe {k}")
    c = plan.get("center") or {}
    if not (isinstance(c.get("raDeg"), (int, float)) and 0 <= c["raDeg"] < 360 and isinstance(c.get("decDeg"), (int, float)) and -90 <= c["decDeg"] <= 90):
        raise RetrievalError("the plan needs center.raDeg in [0, 360) and center.decDeg in [-90, 90]")
    if not (isinstance(plan.get("fovArcmin"), (int, float)) and 1 <= plan["fovArcmin"] <= 30):
        raise RetrievalError("the plan needs fovArcmin between 1 and 30")
    files = plan.get("files")
    if not isinstance(files, list) or not files:
        raise RetrievalError("the plan lists no files")
    names = set()
    for f in files:
        if not isinstance(f, dict) or not isinstance(f.get("fileName"), str) or not FILE_RE.match(f["fileName"]):
            raise RetrievalError("every file needs a plain fileName ending in .fits, .fits.gz or .fit")
        if f["fileName"] in names:
            raise RetrievalError(f"{f['fileName']} is listed twice")
        names.add(f["fileName"])
        check_url(str(f.get("sourceUrl", "")), hosts)
        if f.get("sha256") is not None and not re.fullmatch(r"[0-9a-f]{64}", str(f["sha256"])):
            raise RetrievalError(f"{f['fileName']}: sha256 must be 64 lower-case hex characters")
    return plan


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def retrieve(plan: dict, store: DataStore, archive: Archive, approved: list[Approved], *, max_file_mb: int = MAX_FILE_MB,
             now=_now, facts=None, log=print) -> dict:
    """Fetch every file of the plan into fields/<fieldId>/originals/, then write the field manifest. Returns the manifest.

    `facts(bytes) -> dict` reads header facts (default: the reused 3.0 reader through processing.headers); injectable for tests.
    A file whose SHA-256 differs from the plan's is not stored and the run stops with RetrievalError.
    """
    plan = validate_plan(plan)
    entry = next((a for a in approved if a.sequence_id == plan["sequenceId"]), None)
    if entry is None or entry.field_id != plan["fieldId"]:
        raise RetrievalError(f"sequence {plan['sequenceId']} of field {plan['fieldId']} is not in the approved-sequences file")
    if facts is None:
        from ..processing.headers import facts_from_bytes as facts
    field = plan["fieldId"]
    manifest_key = f"fields/{field}/manifest.json"
    manifest = store.read_json(manifest_key) if store.exists(manifest_key) else {"fieldId": field, "originals": [], "products": []}
    by_name = {o["archive"]["fileName"] if o.get("archive") else o["path"].split("/")[-1]: o for o in manifest.get("originals", [])}
    cap = max_file_mb * 1024 * 1024

    for f in plan["files"]:
        name, key = f["fileName"], f"fields/{field}/originals/{f['fileName']}"
        old = by_name.get(name)
        if old and store.exists(key) and (f.get("sha256") in (None, old.get("sha256"))):
            log(f"skip {name}: already in the store (sha256 {old['sha256'][:12]}...)")
            continue
        digest, size, parts = hashlib.sha256(), 0, []
        for block in archive.fetch(f["sourceUrl"]):
            size += len(block)
            if size > cap:
                raise RetrievalError(f"{name}: larger than the cap of {max_file_mb} MB; not stored")
            digest.update(block)
            parts.append(block)
        sha = digest.hexdigest()
        if f.get("sha256") and f["sha256"] != sha:
            raise RetrievalError(f"{name}: SHA-256 {sha} differs from the plan's {f['sha256']}; not stored")
        data = b"".join(parts)
        info = facts(data)
        if info.get("headerCheck") == "synthetic":
            raise RetrievalError(f"{name}: the header says this is a synthetic test file, not an archive observation; not stored")
        store.put(key, data)
        log(f"stored {name}: {size} bytes, sha256 {sha[:12]}...{' (matches the plan)' if f.get('sha256') else ' (no checksum in the plan: computed here)'}")
        by_name[name] = {
            "frameId": "", "path": f"originals/{name}", "sizeBytes": size, "sha256": sha,
            "detector": info.get("detector"), "mjd": info.get("mjd"), "timeKeyword": info.get("timeKeyword"),
            "headerCheck": info.get("headerCheck", "unverified"), "bunit": info.get("bunit"), "readError": info.get("error"),
            "archive": {"sourceUrl": f["sourceUrl"], "fileName": name, "obsId": info.get("obsId"), "retrievedAt": now(),
                        "sha256CheckedAgainstPlan": bool(f.get("sha256"))},
        }

    originals = sorted(by_name.values(), key=lambda o: (o.get("mjd") is None, o.get("mjd") or 0, o["path"]))
    for i, o in enumerate(originals):
        o["frameId"] = f"o{i:03d}"
    manifest.update({"manifestVersion": now(), "fieldId": field,
                     "center": {"raDeg": plan["center"]["raDeg"], "decDeg": plan["center"]["decDeg"], "frame": "ICRS"},
                     "fovArcmin": plan["fovArcmin"], "originals": originals})
    manifest.setdefault("products", [])
    store.put_json(manifest_key, manifest)
    return manifest


def _make_store(settings: Settings) -> DataStore:
    from app import make_store                       # the same store the server would use (local folder or bucket), from the environment
    return make_store(settings)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Copy approved SPHEREx originals from the archive into the store (author only).")
    ap.add_argument("--plan", required=True, type=Path)
    ap.add_argument("--confirm-download", action="store_true", help="actually download; without it the plan is only printed")
    ap.add_argument("--max-file-mb", type=int, default=MAX_FILE_MB)
    args = ap.parse_args(argv)
    try:
        plan = load_plan(args.plan)
        settings = Settings.from_env()
        if settings.profile != "full":
            raise RetrievalError("set BLINK_PROFILE=full (and SPHEREX_DATA_DIR or GCS_BUCKET) for retrieval")
        approved = load_approved(settings.approved_file)
        if not any(a.sequence_id == plan["sequenceId"] and a.field_id == plan["fieldId"] for a in approved):
            raise RetrievalError(f"sequence {plan['sequenceId']} is not in {settings.approved_file.name}")
        print(f"plan: field {plan['fieldId']}, sequence {plan['sequenceId']}, {len(plan['files'])} file(s) into the {settings.data_source} store")
        for f in plan["files"]:
            print(f"  {f['fileName']}  <-  {f['sourceUrl']}{'  (sha256 given)' if f.get('sha256') else ''}")
        if not args.confirm_download:
            print("dry run: nothing downloaded. Add --confirm-download to fetch these files.")
            return 0
        retrieve(plan, _make_store(settings), HttpsArchive(), approved, max_file_mb=args.max_file_mb)
        return 0
    except (RetrievalError, ArchiveError, StoreError, ValueError) as exc:
        print(f"refused: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
