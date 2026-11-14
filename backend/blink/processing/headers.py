"""What the manifest and the processing job need from an original's header, read with the reused 3.0 reader (reused/query.py, unchanged).

Only facts the 3.0 code already reads are used (docs/DATA_CONTRACT.md section 11): the time keyword, DETECTOR, OBSID, BUNIT, the header check.
Nothing here invents a keyword: a value that is not in the header is None.
"""

from __future__ import annotations

import tempfile
import warnings
from pathlib import Path

from astropy.io import fits

from .reused.query import MJD_KEYS, read_frame_file


def time_keyword(path: Path) -> str | None:
    """The header keyword the time came from, in the order 3.0 tries them."""
    with fits.open(path, memmap=True) as hdul:
        merged = hdul[0].header.copy()
        for h in hdul[1:2]:
            merged.update(h.header)
        return next((k for k in MJD_KEYS if k in merged and merged[k] not in (None, "")), None)


def header_facts(path: Path) -> dict:
    """{ detector, mjd, obsId, headerCheck, bunit, timeKeyword } of a FITS file, or { error } when 3.0's reader refuses it."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            f = read_frame_file(Path(path))
            with fits.open(path, memmap=True) as hdul:
                merged = hdul[0].header.copy()
                merged.update(hdul[f.image_hdu].header)
                obs = merged.get("OBSID")
    except Exception as exc:  # noqa: BLE001 - a file the reader refuses is reported, never guessed
        return {"error": f"not readable as a SPHEREx image ({exc.__class__.__name__}: {exc})"}
    return {"detector": f.detector, "mjd": f.mjd, "obsId": str(obs) if obs not in (None, "") else None,
            "headerCheck": f.provenance, "bunit": f.bunit, "timeKeyword": time_keyword(path)}


def facts_from_bytes(data: bytes, suffix: str = ".fits") -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / f"original{suffix}"
        p.write_bytes(data)
        return header_facts(p)
