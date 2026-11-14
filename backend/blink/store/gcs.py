"""STORAGE: a Google Cloud Storage bucket (GCS_BUCKET, optional GCS_PREFIX), through the official `google-cloud-storage` client (pinned in
requirements.txt, Apache-2.0, CREDITS.md).

Authentication is Application Default Credentials only: on Cloud Run that is the identity of the service; on the author's machine it is
`gcloud auth application-default login`. There is no key-file setting on purpose. Nothing here creates, lists or changes buckets; it reads and
writes objects under the prefix. The tests pass a fake client (no network, no account): `client=` is injectable.

Messages never contain the bucket name, the prefix or a credential, because health answers are public.
"""

from __future__ import annotations

from typing import Iterator

from .base import CHUNK, DataStore, StoreError, check_key


class GcsStore(DataStore):
    kind = "CLOUD"

    def __init__(self, bucket: str, prefix: str = "", project: str | None = None, client=None):
        if not bucket:
            raise StoreError("no bucket configured")
        self.prefix = prefix.strip("/")
        if self.prefix:
            check_key(self.prefix)
        if client is None:
            from google.cloud import storage            # imported here: the edu profile and the tests never need the library
            client = storage.Client(project=project)    # Application Default Credentials
        self._bucket = client.bucket(bucket)

    def _name(self, key: str) -> str:
        key = check_key(key)
        return f"{self.prefix}/{key}" if self.prefix else key

    def _key(self, name: str) -> str:
        return name[len(self.prefix) + 1:] if self.prefix else name

    def exists(self, key: str) -> bool:
        try:
            return bool(self._bucket.blob(self._name(key)).exists())
        except StoreError:
            return False
        except Exception as exc:  # noqa: BLE001 - any client error means the store cannot answer
            raise StoreError("The cloud store could not be read.") from exc

    def open(self, key: str) -> Iterator[bytes]:
        blob = self._bucket.blob(self._name(key))
        try:
            handle = blob.open("rb", chunk_size=CHUNK)      # streamed in chunks, never the whole object in memory
        except Exception as exc:  # noqa: BLE001
            raise StoreError("no such object in the store") from exc

        def chunks() -> Iterator[bytes]:
            try:
                with handle:
                    while True:
                        chunk = handle.read(CHUNK)
                        if not chunk:
                            return
                        yield chunk
            except Exception as exc:  # noqa: BLE001
                raise StoreError("The cloud store could not be read.") from exc

        return chunks()

    def put(self, key: str, data: bytes) -> None:
        try:
            self._bucket.blob(self._name(key)).upload_from_string(bytes(data), content_type="application/octet-stream")
        except Exception as exc:  # noqa: BLE001
            raise StoreError("The cloud store could not be written.") from exc

    def list(self, prefix: str = "") -> list[str]:
        if prefix:
            full = self._name(prefix.rstrip("/")) + ("/" if prefix.endswith("/") else "")
        else:
            full = self.prefix + "/" if self.prefix else ""
        try:
            return sorted(self._key(b.name) for b in self._bucket.list_blobs(prefix=full))
        except Exception as exc:  # noqa: BLE001
            raise StoreError("The cloud store could not be listed.") from exc

    def reachable(self) -> tuple[bool, str | None]:
        """One small listing under the prefix: needs only object read/list permission (not bucket metadata)."""
        try:
            for _ in self._bucket.list_blobs(prefix=(self.prefix + "/") if self.prefix else None, max_results=1):
                break
            return True, None
        except Exception:  # noqa: BLE001
            return False, "The cloud store cannot be reached (permission, network or configuration)."
