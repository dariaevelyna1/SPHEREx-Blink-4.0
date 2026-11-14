"""SPHEREx Blink 4.0 backend: SERVING. One codebase, two profiles (BLINK_PROFILE=edu | full). Contract: docs/DATA_CONTRACT.md.

Run (from the repository root):
    backend/.venv/Scripts/python.exe -m uvicorn app:app --app-dir backend --port 8010     (macOS/Linux: backend/.venv/bin/python)

Every route is read-only over products that are already in the store. Archive retrieval and scientific processing are command-line jobs
(blink/archive, blink/processing), never endpoints. Configuration comes from environment variables only (.env.example).
"""

from __future__ import annotations

import hmac

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from blink import CODE_VERSION
from blink.approved import ID_RE, Approved, ApprovedError, load_approved
from blink.catalog import Catalog, public_sequence, summary_of
from blink.config import Settings
from blink.limits import Guard, RateLimiter
from blink.store import DataStore, LocalDirStore, StoreError

NOT_FOUND = "No such sequence here."          # the same sentence for "unknown" and "not approved": the difference is not public


def make_store(settings: Settings) -> DataStore:
    if settings.profile == "edu":
        return LocalDirStore(settings.edu_bundle_dir)
    if settings.gcs_bucket:
        from blink.store.gcs import GcsStore          # imported only when a bucket is configured: the edu profile needs no cloud library
        from blink.store.cache import CachedStore
        return CachedStore(GcsStore(settings.gcs_bucket, settings.gcs_prefix, settings.gcp_project or None), settings.cache_dir, settings.cache_max_mb)
    return LocalDirStore(settings.data_dir)


def create_app(settings: Settings | None = None, store: DataStore | None = None, approved: list[Approved] | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    store = store if store is not None else make_store(settings)
    approved_problem = None
    if approved is None and settings.profile == "full":
        try:
            approved = load_approved(settings.approved_file)
        except ApprovedError as exc:
            approved, approved_problem = [], str(exc)
    catalog = Catalog(settings, store, approved)

    app = FastAPI(title="SPHEREx Blink API", version=CODE_VERSION, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings, app.state.catalog = settings, catalog
    # Added first = innermost. CORS is added last so that a refusal by the guard still carries the CORS headers.
    app.add_middleware(Guard, limiter=RateLimiter(settings.rate_limit_per_minute), max_concurrent=settings.max_concurrent,
                       timeout_s=settings.request_timeout_s, trust_forwarded_for=settings.trust_forwarded_for)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["GET", "POST"], allow_headers=["Authorization"])

    def not_found() -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": NOT_FOUND})

    @app.get("/api/health")
    def health():
        doc = catalog.health()
        if approved_problem and not doc["problem"]:
            doc["problem"] = approved_problem
        return doc

    @app.get("/api/sequences")
    def sequences(limit: int = Query(20, ge=1, le=10_000), offset: int = Query(0, ge=0, le=1_000_000)):
        limit = min(limit, settings.max_page_size)                 # the pagination limit is the server's, whatever is asked
        rows = catalog.summaries()
        return {"sequences": rows[offset:offset + limit], "total": len(rows), "limit": limit, "offset": offset}

    @app.get("/api/sequences/{sequence_id}")
    def sequence(sequence_id: str, request: Request):
        doc = catalog.sequence(sequence_id) if ID_RE.match(sequence_id) else None
        return public_sequence(doc, str(request.base_url), catalog.pixels_served()) if doc else not_found()

    def frame_bytes(sequence_id: str, frame_id: str, kind: str):
        if not (ID_RE.match(sequence_id) and ID_RE.match(frame_id)) or catalog.sequence(sequence_id) is None:
            return not_found()
        if not catalog.pixels_served():
            return JSONResponse(status_code=403, content={"detail": "This backend serves derived numbers only: pixels are not served."})
        stream = catalog.open_frame(sequence_id, frame_id, kind)
        if stream is None:
            return JSONResponse(status_code=404, content={"detail": "No such frame in this sequence."})
        return StreamingResponse(stream, media_type="application/octet-stream", headers={"Cache-Control": "public, max-age=3600"})

    @app.get("/api/sequences/{sequence_id}/frames/{frame_id}/data")
    def frame_data(sequence_id: str, frame_id: str):
        return frame_bytes(sequence_id, frame_id, "data")

    @app.get("/api/sequences/{sequence_id}/frames/{frame_id}/mask")
    def frame_mask(sequence_id: str, frame_id: str):
        return frame_bytes(sequence_id, frame_id, "mask")

    @app.get("/api/sequences/{sequence_id}/candidates")
    def candidates(sequence_id: str):
        if not ID_RE.match(sequence_id) or catalog.sequence(sequence_id) is None:
            return not_found()
        doc = catalog.candidates(sequence_id)
        return doc if doc else JSONResponse(status_code=404, content={"detail": "No stored candidates for this sequence."})

    @app.get("/api/cutouts")
    def cutouts(request: Request, ra: float = Query(..., ge=0, lt=360), dec: float = Query(..., ge=-90, le=90),
                fov: float = Query(5, ge=1, le=30), det: str = Query("all", max_length=8)):
        """Compatibility with the 3.0 route: the frames of the public sequence that covers (ra, dec). `fov` is accepted and ignored
        (a product has the size it was processed with); an unknown place gives { "frames": [] } as in 3.0."""
        doc = catalog.covering(ra, dec, det)
        return {"frames": public_sequence(doc, str(request.base_url), catalog.pixels_served())["frames"] if doc else []}

    @app.post("/api/admin/reload")
    def admin_reload(request: Request):
        """Re-read the store index and the allow-list. Protected by a bearer token that exists only in the server's environment."""
        if not settings.admin_token:
            return JSONResponse(status_code=403, content={"detail": "Admin endpoints are disabled on this server."})
        given = request.headers.get("authorization", "")
        if not (given.startswith("Bearer ") and hmac.compare_digest(given[7:].encode(), settings.admin_token.encode())):
            return JSONResponse(status_code=403, content={"detail": "Not authorised."})
        if hasattr(store, "clear"):
            store.clear()                                    # the read-through cache: products may have been rewritten
        try:
            catalog.reload(load_approved(settings.approved_file) if settings.profile == "full" else None)
        except ApprovedError as exc:
            return JSONResponse(status_code=400, content={"detail": str(exc)})
        return {"reloaded": True, "sequenceCount": len(catalog.summaries())}

    @app.exception_handler(StoreError)
    def store_error(_request, _exc):
        return JSONResponse(status_code=503, content={"detail": "The data store could not be read."})

    @app.exception_handler(RequestValidationError)
    def bad_input(_request, exc):
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", [])[1:])
        return JSONResponse(status_code=400, content={"detail": f"Bad value for {where or 'a parameter'}: {first.get('msg', 'invalid')}."})

    @app.exception_handler(StarletteHTTPException)
    def http_error(_request, exc):
        return JSONResponse(status_code=exc.status_code, content={"detail": NOT_FOUND if exc.status_code == 404 else str(exc.detail)})

    return app


app = create_app()
