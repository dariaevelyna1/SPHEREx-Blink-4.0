"""SCIENTIFIC PROCESSING: the originals of one field and one detector -> a Sequence product (docs/DATA_CONTRACT.md sections 3-7 and 9).

Every numerical step is 3.0's validated code, reused unchanged (blink/processing/reused/, attributed in CREDITS.md):
    read the header                  reused/query.read_frame_file      (time, detector, band, WCS, pixel scale, BUNIT, header check)
    one north-up grid                reused/cutout.target_wcs          (scale = median of the frames' scales, as 3.0 app.py)
    resample                         reused/cutout.cutout, bilinear    (NaN-aware; frames with < 50 % valid pixels dropped, as 3.0)
    float pixels and mask bytes      reused/floatdata                  (median subtracted, row 0 = north; BAD flag bits of reused/flags)
    candidates                       frontend/js/core/features/movers.js (movers-2), through scripts/candidates_for_product.mjs (Node)

Written back to the store: fields/<f>/products/<sequenceId>/sequence.json, frames/<id>.f32, frames/<id>.mask.u8, candidates.json, and the
sequence id in the manifest's "products". Run by the author where the originals are:

    backend/.venv/bin/python -m blink.processing.job --field my-field --sequence my-field-d2 --detector D2
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from astropy.io import fits

from .. import CODE_VERSION, CONTRACT_VERSION
from ..approved import ID_RE, load_approved
from ..config import REPO_DIR, Settings
from ..store import DataStore, StoreError
from .reused.cutout import cutout, flag_summary, target_wcs
from .reused.floatdata import float_cutout_bytes, mask_cutout_bytes
from .reused.query import WAVEMAX_KEYS, WAVEMIN_KEYS, _wavelength_range_from_wcs, read_frame_file

MIN_VALID = 0.5
REUSED_FROM = "SPHEREx-Blink-3.0@06ac378 backend/spherex/{query,cutout,floatdata,flags}.py (unchanged); detector frontend/js/features/movers.js (movers-2)"
TERMS_REAL = ("SPHEREx data from NASA/IPAC IRSA, processed by SPHEREx Blink. Terms of use and the acknowledgement wording are [unverified] "
              "(decision 4): not for redistribution until the author has checked them.")


class ProcessingError(ValueError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sig(v: float, digits: int = 4) -> float:
    return float(f"{v:.{digits}g}") if np.isfinite(v) else 0.0


def frame_stats(arr: np.ndarray) -> dict:
    """validFraction, robust noise sigma (1.4826 x MAD) and range of the float pixels: numbers that do not reveal the image."""
    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        return {"validFraction": 0.0, "noiseSigma": 0.0, "min": 0.0, "max": 0.0}
    med = float(np.median(finite))
    return {"validFraction": round(finite.size / arr.size, 4), "noiseSigma": _sig(1.4826 * float(np.median(np.abs(finite - med)))),
            "min": _sig(float(finite.min())), "max": _sig(float(finite.max()))}


def wavelength_source(path: Path, image_hdu: int) -> str:
    """Where reused/query.read_frame_file took the band from: "header" (WAVEMIN/WAVEMAX), "WCS-WAVE", or "nominal" (3.0's rough table)."""
    with fits.open(path, memmap=True) as hdul:
        merged = hdul[0].header.copy()
        merged.update(hdul[image_hdu].header)
        if any(k in merged for k in WAVEMIN_KEYS) and any(k in merged for k in WAVEMAX_KEYS):
            return "header"
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return "WCS-WAVE" if _wavelength_range_from_wcs(hdul, image_hdu) else "nominal"


def node_detector(product_dir: Path) -> dict:
    """Run the reused JS detector on a product folder (scripts/candidates_for_product.mjs). Needs Node on the machine of the job."""
    node = shutil.which("node")
    if not node:
        raise ProcessingError("Node is not installed: the candidates step needs it (or run with --no-candidates)")
    script = REPO_DIR / "scripts" / "candidates_for_product.mjs"
    r = subprocess.run([node, str(script), str(product_dir)], capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        raise ProcessingError(f"the detector failed: {r.stderr.strip()[-400:]}")
    return json.loads(r.stdout)


def process(store: DataStore, field_id: str, sequence_id: str, detector: str, *, title: str | None = None, now=_now,
            candidates=node_detector, log=print) -> dict:
    """Make one Sequence product. Returns the sequence document. `candidates(product_dir) -> CandidateSet | None` is injectable."""
    if not (ID_RE.match(field_id) and ID_RE.match(sequence_id)):
        raise ProcessingError("field and sequence ids must be URL-safe")
    manifest = store.get_manifest(field_id)
    center, fov = manifest["center"], float(manifest["fovArcmin"])
    chosen = [o for o in manifest["originals"] if o.get("detector") == detector and not o.get("readError")]
    if any(o.get("headerCheck") == "synthetic" for o in chosen):
        raise ProcessingError("a synthetic test file is among the originals: a real product is made from archive observations only")
    if not chosen:
        raise ProcessingError(f"no readable original of {detector} in the manifest of {field_id}")

    with tempfile.TemporaryDirectory(prefix="blink-proc-") as tmp:
        tmpdir = Path(tmp)
        files, seen = [], set()
        for o in chosen:
            data = b"".join(store.open_frame(field_id, o["path"]))
            sha = hashlib.sha256(data).hexdigest()
            if sha != o["sha256"]:
                raise ProcessingError(f"{o['path']}: the stored bytes do not match the manifest's SHA-256")
            if sha in seen:
                log(f"skip {o['path']}: the same bytes as another original (one exposure counted once)")
                continue
            seen.add(sha)
            p = tmpdir / Path(o["path"]).name
            p.write_bytes(data)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                files.append((o, read_frame_file(p)))
        files.sort(key=lambda t: t[1].mjd)
        scale = float(np.median([f.pixel_scale_arcsec for _, f in files]))
        tgt, npix = target_wcs(center["raDeg"], center["decDeg"], fov, scale)

        frames, blobs, dropped = [], {}, 0
        for o, f in files:
            img, flags = cutout(f, tgt, npix)
            valid = float(np.isfinite(img).mean())
            if valid < MIN_VALID:
                dropped += 1
                log(f"drop {o['path']}: {valid:.0%} of the field on this frame (needs {MIN_VALID:.0%})")
                continue
            fid = f"f{len(frames):03d}"
            data, mask = float_cutout_bytes(img), mask_cutout_bytes(flags, (npix, npix))
            blobs[fid] = (data, mask)
            arr = np.frombuffer(data, dtype="<f4")
            arch = o.get("archive") or {}
            frames.append({
                "frameId": fid, "mjd": f.mjd, "dateISO": f.date_iso, "timeKeyword": o.get("timeKeyword"), "detector": f.detector,
                "wavelengthMinUm": round(f.wave_min_um, 4), "wavelengthMaxUm": round(f.wave_max_um, 4), "wavelengthSource": wavelength_source(f.path, f.image_hdu),
                "pixelScaleArcsec": round(scale, 4), "unit": f.bunit, "dataKind": "real", "backgroundSubtracted": True, "pixelsServed": False,
                "dataUrl": f"frames/{fid}.f32", "maskUrl": f"frames/{fid}.mask.u8", "imageUrl": None, "flagsUrl": None,
                "sha256Pixels": hashlib.sha256(data).hexdigest(), "flags": flag_summary(flags), "stats": frame_stats(arr),
                "provenance": {"headerCheck": f.provenance if f.provenance != "synthetic" else "unverified", "origin": "archive", "generator": None,
                               "archive": {"sourceUrl": arch.get("sourceUrl"), "fileName": arch.get("fileName") or Path(o["path"]).name,
                                           "obsId": arch.get("obsId"), "sha256": o["sha256"], "sizeBytes": o["sizeBytes"],
                                           "retrievedAt": arch.get("retrievedAt")}},
            })
        if not frames:
            raise ProcessingError("no frame covers at least half of the field")

        units = {fr["unit"] for fr in frames}
        s = scale / 3600
        sequence = {
            "contractVersion": CONTRACT_VERSION, "sequenceId": sequence_id, "fieldId": field_id,
            "title": title or f"{field_id} {detector}", "dataKind": "real", "detector": detector,
            "center": {"raDeg": center["raDeg"], "decDeg": center["decDeg"], "frame": "ICRS"}, "fovArcmin": fov,
            "grid": {"projection": "TAN", "orientation": "north up, east left", "rowOrder": "row 0 = north", "n": npix,
                     "pixelScaleArcsec": round(scale, 4), "crvalDeg": [center["raDeg"], center["decDeg"]],
                     "crpix": [(npix + 1) / 2, (npix + 1) / 2], "cdDeg": [[-s, 0.0], [0.0, s]]},
            "unit": units.pop() if len(units) == 1 else None, "pixelsServed": False, "frames": frames,
            "processing": {"steps": [f"read {len(files)} original(s) of {detector} (header check, time, band, WCS)",
                                     f"resample: bilinear, NaN-aware, onto one north-up TAN grid of {npix} x {npix} px at {scale:.4f} arcsec/px (median of the frames)",
                                     f"drop frames covering < {MIN_VALID:.0%} of the field ({dropped} dropped)",
                                     "background: per-frame median subtracted", "mask: BAD flag bits 0,1,2,4,5,6,9,10,11"],
                           "codeVersion": CODE_VERSION, "processedAt": now(), "reusedFrom": REUSED_FROM},
            "terms": TERMS_REAL,
        }
        prefix = f"fields/{field_id}/products/{sequence_id}/"
        product = tmpdir / "product"
        (product / "frames").mkdir(parents=True)
        (product / "sequence.json").write_text(json.dumps(sequence), encoding="utf-8")
        for fid, (data, mask) in blobs.items():
            (product / "frames" / f"{fid}.f32").write_bytes(data)
            (product / "frames" / f"{fid}.mask.u8").write_bytes(mask)
        cand = candidates(product) if candidates else None
        if cand is not None:
            sequence["processing"]["steps"].append(f"detect+link: {cand.get('algorithm')} (reused from 3.0)")

        for fid, (data, mask) in blobs.items():
            store.put(f"{prefix}frames/{fid}.f32", data)
            store.put(f"{prefix}frames/{fid}.mask.u8", mask)
        if cand is not None:
            store.put_json(prefix + "candidates.json", cand)
        store.put_json(prefix + "sequence.json", sequence)
        manifest = store.get_manifest(field_id)
        if sequence_id not in manifest.setdefault("products", []):
            manifest["products"].append(sequence_id)
            store.put_json(f"fields/{field_id}/manifest.json", manifest)
    log(f"product {sequence_id}: {len(frames)} frame(s) of {npix} x {npix} px, {dropped} dropped, "
        f"{'no candidate step' if cand is None else str(len(cand['candidates'])) + ' candidate(s)'}")
    return sequence


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Process the originals of one field and detector into a Sequence product (offline).")
    ap.add_argument("--field", required=True)
    ap.add_argument("--sequence", required=True)
    ap.add_argument("--detector", required=True)
    ap.add_argument("--title")
    ap.add_argument("--no-candidates", action="store_true")
    a = ap.parse_args(argv)
    try:
        settings = Settings.from_env()
        if settings.profile != "full":
            raise ProcessingError("set BLINK_PROFILE=full (and SPHEREX_DATA_DIR or GCS_BUCKET)")
        if not any(x.sequence_id == a.sequence and x.field_id == a.field for x in load_approved(settings.approved_file)):
            raise ProcessingError(f"sequence {a.sequence} of field {a.field} is not in the approved-sequences file")
        from app import make_store
        process(make_store(settings), a.field, a.sequence, a.detector.upper(), title=a.title, candidates=None if a.no_candidates else node_detector)
        return 0
    except (ProcessingError, StoreError, ValueError) as exc:
        print(f"refused: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
