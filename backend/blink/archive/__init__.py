"""ARCHIVE RETRIEVAL: copy approved originals from the SPHEREx archive (IRSA) into the store, verifying SHA-256. Offline, command line only.

The agent that wrote this never ran it against the real archive (rule 4): the tests use FakeArchive. The author runs it, after deciding which
sequence is approved and that downloading those files is allowed (decisions 1, 4, 8).
"""

from .retrieve import Archive, ArchiveError, FakeArchive, HttpsArchive, RetrievalError, load_plan, retrieve

__all__ = ["Archive", "ArchiveError", "FakeArchive", "HttpsArchive", "RetrievalError", "load_plan", "retrieve"]
