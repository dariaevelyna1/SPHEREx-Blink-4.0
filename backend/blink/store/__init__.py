"""STORAGE: where originals and products live. One interface (DataStore), several places.

    LocalDirStore   a folder (SPHEREX_DATA_DIR, or the edu bundle)
    GcsStore        a Google Cloud Storage bucket (GCS_BUCKET, GCS_PREFIX), Application Default Credentials
    MemoryStore     a dict, for tests

Storage knows nothing about the archive or about processing. Reading a bucket is not the real-data workflow.
"""

from .base import DataStore, StoreError, check_key
from .local import LocalDirStore
from .memory import MemoryStore

__all__ = ["DataStore", "StoreError", "check_key", "LocalDirStore", "MemoryStore"]
