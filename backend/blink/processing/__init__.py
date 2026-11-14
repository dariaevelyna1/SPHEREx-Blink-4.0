"""SCIENTIFIC PROCESSING (storage -> products). Offline job, never an endpoint.

    reused/        3.0's validated modules, unchanged (cutout, flags, floatdata, query); SHA-256 pinned by tests/test_full.py
    headers.py     header facts for the manifest (through reused/query.py)
    job.py         originals of one field and detector -> one Sequence product (+ candidates by the reused JS detector)
"""
