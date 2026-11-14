"""The storage interface. Keys are forward-slash paths relative to the store root, laid out as docs/DATA_CONTRACT.md section 9:

    fields/<fieldId>/manifest.json
    fields/<fieldId>/originals/<fileName>
    fields/<fieldId>/products/<sequenceId>/sequence.json, candidates.json, frames/<frameId>.f32, frames/<frameId>.mask.u8
"""

from __future__ import annotations

import hashlib
import json
import re
from abc import ABC, abstractmethod
from typing import Iterator

CHUNK = 256 * 1024
_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)*$")


class StoreError(Exception):
    """The store could not do what was asked (unreachable, missing object, bad key). The message is safe to show."""


def check_key(key: str) -> str:
    """A key is a relative path of plain segments: no '..', no leading '/', no backslash, nothing a shell or a URL would reinterpret."""
    if not isinstance(key, str) or len(key) > 512 or not _KEY.match(key) or ".." in key.split("/"):
        raise StoreError("invalid storage key")
    return key


class DataStore(ABC):
    """Where originals and products live. `kind` is what the health endpoint reports: LOCAL, CLOUD or MEMORY."""

    kind = "LOCAL"

    # ---- the primitives every store implements
    @abstractmethod
    def exists(self, key: str) -> bool: ...

    @abstractmethod
    def open(self, key: str) -> Iterator[bytes]:
        """The object as a stream of chunks. Raises StoreError if it is missing."""

    @abstractmethod
    def put(self, key: str, data: bytes) -> None: ...

    @abstractmethod
    def list(self, prefix: str = "") -> list[str]:
        """Every key that starts with `prefix`, sorted."""

    @abstractmethod
    def reachable(self) -> tuple[bool, str | None]:
        """(True, None) or (False, a sentence saying what is wrong, with no path, bucket name or credential in it)."""

    # ---- built on the primitives
    def read(self, key: str, max_bytes: int = 64 * 1024 * 1024) -> bytes:
        """A whole (small) object. Refuses anything above max_bytes rather than filling the memory."""
        out, size = [], 0
        for chunk in self.open(key):
            size += len(chunk)
            if size > max_bytes:
                raise StoreError("object too large to read whole")
            out.append(chunk)
        return b"".join(out)

    def read_json(self, key: str) -> dict:
        try:
            doc = json.loads(self.read(key, max_bytes=8 * 1024 * 1024).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise StoreError("a stored document is not valid JSON") from exc
        if not isinstance(doc, dict):
            raise StoreError("a stored document is not a JSON object")
        return doc

    def put_json(self, key: str, doc: dict) -> None:
        self.put(key, (json.dumps(doc, indent=1, allow_nan=False) + "\n").encode("utf-8"))

    def checksum(self, key: str) -> str:
        """SHA-256 (hex) of the stored bytes."""
        digest = hashlib.sha256()
        for chunk in self.open(key):
            digest.update(chunk)
        return digest.hexdigest()

    def size(self, key: str) -> int:
        return sum(len(chunk) for chunk in self.open(key))

    # ---- the field-level view (docs/DATA_CONTRACT.md section 9)
    def list_fields(self) -> list[str]:
        """Field ids that have a manifest."""
        return sorted({k.split("/")[1] for k in self.list("fields/") if k.count("/") == 2 and k.endswith("/manifest.json")})

    def get_manifest(self, field_id: str) -> dict:
        return self.read_json(check_key(f"fields/{field_id}/manifest.json"))

    def open_frame(self, field_id: str, frame_path: str) -> Iterator[bytes]:
        """A file of a field as a stream; `frame_path` is relative to the field folder, as in the manifest (e.g. "originals/x.fits")."""
        return self.open(check_key(f"fields/{field_id}/{frame_path}"))
