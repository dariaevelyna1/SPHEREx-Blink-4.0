"""SPHEREx Blink 4.0 backend: one codebase, two profiles (edu, full).

Three things are kept apart on purpose (docs/DATA_CONTRACT.md):
    blink.archive      ARCHIVE RETRIEVAL      copy approved originals from the archive into the store (offline, command line)
    blink.processing   SCIENTIFIC PROCESSING  originals -> products on one grid (offline job)
    blink.store        STORAGE                where originals and products live (local folder, Google Cloud Storage, memory for tests)
and, on top of storage only:
    blink.catalog / app.py   SERVING          read-only public endpoints over processed, approved sequences
"""

CONTRACT_VERSION = "blink-4.0/1"
CODE_VERSION = "blink-4.0 backend-1"
