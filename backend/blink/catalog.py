"""SERVING, part 1: which sequences exist for the public, and how to read them from the store. Read-only.

    edu   the synthetic bundle (sequences.json + sequences/<id>/...). Only synthetic sequences are ever listed.
    full  the store laid out as docs/DATA_CONTRACT.md section 9, filtered by the allow-list:
          a sequence is public only if it is approved AND its product exists AND (it is synthetic, OR real data is enabled
          AND the entry says the terms were checked). Anything else does not exist (404), without saying why.

The catalog never retrieves from the archive and never processes: it reads products that are already in the store.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Iterator

from . import CONTRACT_VERSION
from .approved import ID_RE, Approved
from .config import Settings
from .store import DataStore, StoreError

PASS_GAP_DAYS = 30          # frames less than this apart are one survey pass (the rule of the reused detector, movers.js passIndices)
HEAD_KEYS = ("contractVersion", "sequenceId", "fieldId", "title", "dataKind", "detector", "center", "fovArcmin", "grid", "unit", "pixelsServed", "terms")


def pass_count(mjds: list[float]) -> int:
    return 1 + sum(1 for a, b in zip(mjds, mjds[1:]) if b - a >= PASS_GAP_DAYS) if mjds else 0


def summary_of(doc: dict) -> dict:
    mjds = [f["mjd"] for f in doc["frames"]]
    return {**{k: doc[k] for k in HEAD_KEYS if k in doc}, "frameCount": len(mjds), "mjdFirst": mjds[0], "mjdLast": mjds[-1], "passCount": pass_count(mjds)}


def _valid_shape(doc: dict) -> bool:
    """The minimum the server needs to serve a product safely; the full contract check is the client's (frontend/js/shared/contract.js)."""
    try:
        return (doc.get("contractVersion") == CONTRACT_VERSION and ID_RE.match(doc["sequenceId"]) is not None
                and doc.get("dataKind") in ("synthetic", "real") and isinstance(doc["grid"]["n"], int)
                and isinstance(doc["frames"], list) and len(doc["frames"]) > 0
                and all(ID_RE.match(f["frameId"]) and isinstance(f["mjd"], (int, float)) and f.get("dataKind") == doc["dataKind"] for f in doc["frames"]))
    except (KeyError, TypeError):
        return False


class Catalog:
    def __init__(self, settings: Settings, store: DataStore, approved: list[Approved] | None = None):
        self.settings, self.store = settings, store
        self.approved = list(approved or [])
        self._lock = threading.Lock()
        self._prefix: dict[str, str] = {}        # sequenceId -> key prefix of its product
        self._docs: dict[str, dict] = {}         # sequenceId -> the stored sequence document (relative URLs)
        self._problem: str | None = None
        self._manifest_version: str | None = None
        self.reload()

    # ------------------------------------------------------------------ index
    def reload(self, approved: list[Approved] | None = None) -> None:
        """Re-read the store's index (and take a new allow-list if one is given). A failure is kept as `problem`, never raised."""
        with self._lock:
            if approved is not None:
                self.approved = list(approved)
            prefix, docs, problem, version = {}, {}, None, None
            try:
                ok, why = self.store.reachable()
                if not ok:
                    raise StoreError(why or "The store cannot be reached.")
                if self.settings.profile == "edu":
                    version = self.store.read_json("health.json").get("manifestVersion") if self.store.exists("health.json") else None
                    for s in self.store.read_json("sequences.json").get("sequences", []):
                        sid = s.get("sequenceId") if isinstance(s, dict) else None
                        if isinstance(sid, str) and ID_RE.match(sid):
                            prefix[sid] = f"sequences/{sid}/"
                else:
                    versions = []
                    for a in self.approved:
                        prefix[a.sequence_id] = f"fields/{a.field_id}/products/{a.sequence_id}/"
                        key = f"fields/{a.field_id}/manifest.json"
                        if self.store.exists(key):
                            versions.append(str(self.store.read_json(key).get("manifestVersion") or ""))
                    version = max((v for v in versions if v), default=None)
                skipped = 0
                for sid, pre in prefix.items():
                    if not self.store.exists(pre + "sequence.json"):
                        skipped += 1
                        continue
                    doc = self.store.read_json(pre + "sequence.json")
                    if not _valid_shape(doc) or doc["sequenceId"] != sid or not self._may_serve(sid, doc):
                        skipped += 1
                        continue
                    docs[sid] = doc
                if self.settings.profile == "edu" and skipped:
                    problem = f"{skipped} sequence(s) of the bundle could not be served (missing, invalid, or not synthetic)."
            except StoreError as exc:
                prefix, docs, problem = {}, {}, str(exc) or "The store cannot be read."
            self._prefix, self._docs, self._problem, self._manifest_version = prefix, docs, problem, version

    def _may_serve(self, sid: str, doc: dict) -> bool:
        if self.settings.profile == "edu":
            return doc["dataKind"] == "synthetic"                # the edu profile never serves real data, whatever is in its folder
        entry = next((a for a in self.approved if a.sequence_id == sid), None)
        if entry is None:
            return False
        if doc["dataKind"] == "real":
            return self.settings.real_data_enabled and entry.terms_checked
        return True

    # ------------------------------------------------------------------ what the endpoints read
    def pixels_served(self) -> bool:
        return True if self.settings.profile == "edu" else self.settings.serve_pixels

    def health(self) -> dict:
        ok, why = self.store.reachable()
        problem = (why if not ok else self._problem)
        return {
            "contractVersion": CONTRACT_VERSION, "profile": self.settings.profile, "dataSource": self.settings.data_source,
            "storeReachable": bool(ok and not (self._problem and not self._docs and self.settings.profile == "edu")),
            "manifestVersion": self._manifest_version,
            "realDataEnabled": self.settings.real_data_enabled if self.settings.profile == "full" else False,
            "servePixels": self.pixels_served(), "sequenceCount": len(self._docs),
            "time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "problem": problem,
        }

    def summaries(self) -> list[dict]:
        served = self.pixels_served()
        return [{**summary_of(d), "pixelsServed": served} for d in self._docs.values()]

    def sequence(self, sequence_id: str) -> dict | None:
        return self._docs.get(sequence_id)

    def frame_key(self, sequence_id: str, frame_id: str, kind: str) -> str | None:
        """The store key of a frame's pixels ("data") or mask ("mask"), or None if the sequence or frame is not public."""
        doc = self._docs.get(sequence_id)
        if doc is None or not any(f["frameId"] == frame_id for f in doc["frames"]):
            return None
        return f"{self._prefix[sequence_id]}frames/{frame_id}{'.f32' if kind == 'data' else '.mask.u8'}"

    def open_frame(self, sequence_id: str, frame_id: str, kind: str) -> Iterator[bytes] | None:
        key = self.frame_key(sequence_id, frame_id, kind)
        return self.store.open(key) if key and self.store.exists(key) else None

    def candidates(self, sequence_id: str) -> dict | None:
        if sequence_id not in self._docs:
            return None
        key = self._prefix[sequence_id] + "candidates.json"
        return self.store.read_json(key) if self.store.exists(key) else None

    def covering(self, ra: float, dec: float, det: str) -> dict | None:
        """The public sequence whose field contains (ra, dec) for a detector ("all" = any), nearest centre first. For /api/cutouts."""
        import math
        best, best_d = None, float("inf")
        for doc in self._docs.values():
            if det != "all" and doc["detector"] != det:
                continue
            c, half = doc["center"], doc["fovArcmin"] / 2
            d_ra = (ra - c["raDeg"] + 180) % 360 - 180
            east, north = d_ra * 60 * math.cos(math.radians(c["decDeg"])), (dec - c["decDeg"]) * 60
            if abs(east) <= half and abs(north) <= half and math.hypot(east, north) < best_d:
                best, best_d = doc, math.hypot(east, north)
        return best


def public_sequence(doc: dict, base_url: str, served: bool) -> dict:
    """The document as the API returns it: absolute pixel URLs when pixels are served, none at all when they are not."""
    sid = doc["sequenceId"]
    frames = []
    for f in doc["frames"]:
        url = f"{base_url}api/sequences/{sid}/frames/{f['frameId']}"
        frames.append({**f, "pixelsServed": served, "dataUrl": f"{url}/data" if served else None, "maskUrl": f"{url}/mask" if served else None,
                       "imageUrl": None, "flagsUrl": None})
    return {**doc, "pixelsServed": served, "frames": frames}
