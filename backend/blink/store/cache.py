"""STORAGE: a local read-through cache in front of another store (used in front of GcsStore). Git-ignored folder (BLINK_CACHE_DIR), size-capped
(BLINK_CACHE_MAX_MB): the least recently used objects are removed first. A cached object is checked against nothing remote on every read: the
products are immutable by convention (a new processing run writes a new sequence or is followed by an admin reload, which clears the cache).
"""

from __future__ import annotations

import hashlib
import os
import threading
from pathlib import Path
from typing import Iterator

from .base import CHUNK, DataStore, StoreError, check_key


class CachedStore(DataStore):
    def __init__(self, inner: DataStore, cache_dir: Path | str, max_mb: int = 256, max_object_mb: int = 64):
        self.inner, self.dir = inner, Path(cache_dir)
        self.max_bytes, self.max_object = int(max_mb) * 1024 * 1024, int(max_object_mb) * 1024 * 1024
        self.kind = inner.kind
        self._lock = threading.Lock()

    def _path(self, key: str) -> Path:
        return self.dir / hashlib.sha256(check_key(key).encode()).hexdigest()

    def exists(self, key: str) -> bool:
        return self._path(key).is_file() or self.inner.exists(key)

    def open(self, key: str) -> Iterator[bytes]:
        path = self._path(key)
        if path.is_file():
            os.utime(path)                                       # recently used
            return _file_chunks(path)
        if self.max_bytes <= 0:
            return self.inner.open(key)
        data, size = [], 0
        for chunk in self.inner.open(key):
            size += len(chunk)
            if size > self.max_object:                           # too big to cache: stream the rest straight through
                return _chain(data + [chunk], self.inner_rest(key, size))
            data.append(chunk)
        blob = b"".join(data)
        self._store(path, blob)
        return iter([blob[i:i + CHUNK] for i in range(0, max(len(blob), 1), CHUNK)])

    def inner_rest(self, key: str, skip: int) -> Iterator[bytes]:
        """The object after its first `skip` bytes (re-opened; the inner stores have no seek)."""
        seen = 0
        for chunk in self.inner.open(key):
            if seen + len(chunk) <= skip:
                seen += len(chunk)
                continue
            yield chunk[max(0, skip - seen):]
            seen += len(chunk)

    def _store(self, path: Path, blob: bytes) -> None:
        with self._lock:
            self.dir.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(path.name + ".part")
            tmp.write_bytes(blob)
            os.replace(tmp, path)
            self._evict()

    def _evict(self) -> None:
        files = sorted((p for p in self.dir.iterdir() if p.is_file() and not p.name.endswith(".part")), key=lambda p: p.stat().st_mtime)
        total = sum(p.stat().st_size for p in files)
        while files and total > self.max_bytes:
            victim = files.pop(0)
            total -= victim.stat().st_size
            victim.unlink(missing_ok=True)

    def clear(self) -> None:
        with self._lock:
            if self.dir.is_dir():
                for p in self.dir.iterdir():
                    if p.is_file():
                        p.unlink(missing_ok=True)

    def put(self, key: str, data: bytes) -> None:
        self.inner.put(key, data)
        self._path(key).unlink(missing_ok=True)

    def list(self, prefix: str = "") -> list[str]:
        return self.inner.list(prefix)

    def reachable(self) -> tuple[bool, str | None]:
        return self.inner.reachable()

    def cached_bytes(self) -> int:
        return sum(p.stat().st_size for p in self.dir.iterdir() if p.is_file()) if self.dir.is_dir() else 0


def _file_chunks(path: Path) -> Iterator[bytes]:
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(CHUNK)
            if not chunk:
                return
            yield chunk


def _chain(head: list[bytes], rest: Iterator[bytes]) -> Iterator[bytes]:
    yield from head
    yield from rest


__all__ = ["CachedStore", "StoreError"]
