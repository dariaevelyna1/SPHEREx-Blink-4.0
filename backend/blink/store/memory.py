"""A store in memory: the FAKE store of the tests. No disk, no network, no cloud."""

from __future__ import annotations

from typing import Iterator

from .base import CHUNK, DataStore, StoreError, check_key


class MemoryStore(DataStore):
    kind = "MEMORY"

    def __init__(self, objects: dict[str, bytes] | None = None, kind: str = "MEMORY"):
        self.objects: dict[str, bytes] = dict(objects or {})
        self.kind = kind                    # tests set "CLOUD" to stand in for a bucket
        self.down: str | None = None        # set to a sentence to simulate an unreachable store
        self.reads: list[str] = []          # every key opened, for tests that count reads

    def exists(self, key: str) -> bool:
        return check_key(key) in self.objects

    def open(self, key: str) -> Iterator[bytes]:
        if self.down:
            raise StoreError(self.down)
        data = self.objects.get(check_key(key))
        if data is None:
            raise StoreError("no such object in the store")
        self.reads.append(key)
        return (data[i:i + CHUNK] for i in range(0, max(len(data), 1), CHUNK))

    def put(self, key: str, data: bytes) -> None:
        if self.down:
            raise StoreError(self.down)
        self.objects[check_key(key)] = bytes(data)

    def list(self, prefix: str = "") -> list[str]:
        if self.down:
            raise StoreError(self.down)
        return sorted(k for k in self.objects if k.startswith(prefix))

    def reachable(self) -> tuple[bool, str | None]:
        return (False, self.down) if self.down else (True, None)
