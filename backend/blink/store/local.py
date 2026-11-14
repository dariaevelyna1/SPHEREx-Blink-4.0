"""A store that is a folder on this machine (SPHEREX_DATA_DIR for the full profile, the committed bundle for edu)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

from .base import CHUNK, DataStore, StoreError, check_key


class LocalDirStore(DataStore):
    kind = "LOCAL"

    def __init__(self, root: Path | str):
        self.root = Path(root)

    def _path(self, key: str) -> Path:
        path = (self.root / check_key(key)).resolve()
        if self.root.resolve() not in path.parents:              # belt and braces: a key can never leave the root
            raise StoreError("invalid storage key")
        return path

    def exists(self, key: str) -> bool:
        try:
            return self._path(key).is_file()
        except StoreError:
            return False

    def open(self, key: str) -> Iterator[bytes]:
        path = self._path(key)
        if not path.is_file():
            raise StoreError("no such object in the store")

        def chunks() -> Iterator[bytes]:
            with path.open("rb") as handle:
                while True:
                    chunk = handle.read(CHUNK)
                    if not chunk:
                        return
                    yield chunk

        return chunks()

    def put(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".part")
        tmp.write_bytes(data)
        os.replace(tmp, path)                                    # never a half-written object under the final name

    def list(self, prefix: str = "") -> list[str]:
        if not self.root.is_dir():
            return []
        keys = (p.relative_to(self.root).as_posix() for p in self.root.rglob("*") if p.is_file() and not p.name.endswith(".part"))
        return sorted(k for k in keys if k.startswith(prefix))

    def reachable(self) -> tuple[bool, str | None]:
        return (True, None) if self.root.is_dir() else (False, "The local data folder does not exist.")
