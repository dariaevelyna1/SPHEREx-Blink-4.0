"""The allow-list of approved sequences: a JSON file the author edits by hand (backend/approved_sequences.json, ships empty).

    { "approved": [ { "sequenceId": "...", "fieldId": "...", "approvedBy": "...", "approvedOn": "YYYY-MM-DD", "termsChecked": true } ] }

A sequence that is not in this file does not exist for the public endpoints. `termsChecked` is the author's statement that the data terms
were read for that sequence (decision 4); real data is served only when it is true AND REAL_DATA_ENABLED is true.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


@dataclass(frozen=True)
class Approved:
    sequence_id: str
    field_id: str
    terms_checked: bool = False
    approved_by: str = ""
    approved_on: str = ""


class ApprovedError(ValueError):
    pass


def parse_approved(doc: object) -> list[Approved]:
    if not isinstance(doc, dict) or not isinstance(doc.get("approved"), list):
        raise ApprovedError('the approved-sequences file must be { "approved": [ ... ] }')
    out, seen = [], set()
    for entry in doc["approved"]:
        if not isinstance(entry, dict):
            raise ApprovedError("an approved entry must be an object")
        seq, fld = entry.get("sequenceId"), entry.get("fieldId")
        if not (isinstance(seq, str) and ID_RE.match(seq) and isinstance(fld, str) and ID_RE.match(fld)):
            raise ApprovedError("an approved entry needs a URL-safe sequenceId and fieldId")
        if seq in seen:
            raise ApprovedError(f"sequence {seq} is listed twice")
        seen.add(seq)
        out.append(Approved(seq, fld, entry.get("termsChecked") is True, str(entry.get("approvedBy") or ""), str(entry.get("approvedOn") or "")))
    return out


def load_approved(path: Path) -> list[Approved]:
    """The list in the file; a missing file is an empty list (nothing approved)."""
    if not path.is_file():
        return []
    try:
        return parse_approved(json.loads(path.read_text(encoding="utf-8")))
    except json.JSONDecodeError as exc:
        raise ApprovedError("the approved-sequences file is not valid JSON") from exc
