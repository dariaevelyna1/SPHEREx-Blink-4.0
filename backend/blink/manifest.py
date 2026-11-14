"""The MANIFEST BUILDER: write fields/<fieldId>/manifest.json for originals that are already in a local folder (the author runs it where
the data are, e.g. files downloaded earlier for 3.0). It computes SHA-256 and size from the files it finds and reads the header facts with
the reused 3.0 reader; it never contacts the archive or a cloud.

    backend/.venv/bin/python -m blink.manifest --data-dir backend/data/store --field my-field --ra 269.4462 --dec 4.769 --fov 5
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

from .approved import ID_RE
from .processing.headers import header_facts
from .store import LocalDirStore, StoreError

SUFFIXES = (".fits", ".fits.gz", ".fit")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def build_manifest(data_dir: Path, field_id: str, ra: float, dec: float, fov: float, *, now: str | None = None, facts=header_facts) -> dict:
    if not ID_RE.match(field_id):
        raise ValueError("the field id must be URL-safe ([a-z0-9-])")
    folder = Path(data_dir) / "fields" / field_id / "originals"
    files = sorted(p for p in folder.glob("*") if p.is_file() and p.name.lower().endswith(SUFFIXES)) if folder.is_dir() else []
    if not files:
        raise ValueError(f"no FITS files in fields/{field_id}/originals/ of the data folder")
    store = LocalDirStore(data_dir)
    key = f"fields/{field_id}/manifest.json"
    old = store.read_json(key) if store.exists(key) else {}
    old_by_path = {o["path"]: o for o in old.get("originals", [])}
    originals = []
    for p in files:
        info, rel = facts(p), f"originals/{p.name}"
        prev = old_by_path.get(rel, {})
        originals.append({
            "frameId": "", "path": rel, "sizeBytes": p.stat().st_size, "sha256": _sha256(p),
            "detector": info.get("detector"), "mjd": info.get("mjd"), "timeKeyword": info.get("timeKeyword"),
            "headerCheck": info.get("headerCheck", "unverified"), "bunit": info.get("bunit"), "readError": info.get("error"),
            # where the file came from is known only if retrieval recorded it; the builder never guesses a URL
            "archive": prev.get("archive") or {"sourceUrl": None, "fileName": p.name, "obsId": info.get("obsId"), "retrievedAt": None,
                                               "sha256CheckedAgainstPlan": False},
        })
    originals.sort(key=lambda o: (o["mjd"] is None, o["mjd"] or 0, o["path"]))
    for i, o in enumerate(originals):
        o["frameId"] = f"o{i:03d}"
    manifest = {"manifestVersion": now or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "fieldId": field_id,
                "center": {"raDeg": ra, "decDeg": dec, "frame": "ICRS"}, "fovArcmin": fov, "originals": originals,
                "products": old.get("products", [])}
    store.put_json(key, manifest)
    return manifest


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build fields/<field>/manifest.json from local originals (no network).")
    ap.add_argument("--data-dir", required=True, type=Path)
    ap.add_argument("--field", required=True)
    ap.add_argument("--ra", required=True, type=float)
    ap.add_argument("--dec", required=True, type=float)
    ap.add_argument("--fov", type=float, default=5.0)
    a = ap.parse_args(argv)
    try:
        m = build_manifest(a.data_dir, a.field, a.ra, a.dec, a.fov)
    except (ValueError, StoreError) as exc:
        print(f"refused: {exc}", file=sys.stderr)
        return 2
    bad = [o["path"] for o in m["originals"] if o["readError"]]
    print(f"manifest written: {len(m['originals'])} original(s), {len(bad)} unreadable{': ' + ', '.join(bad) if bad else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
