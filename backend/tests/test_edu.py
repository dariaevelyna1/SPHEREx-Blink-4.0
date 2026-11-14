"""The edu profile: the committed synthetic bundle through the routes of docs/DATA_CONTRACT.md section 2, with the limits on.

No network, no cloud, no real data: the store is the bundle folder of the repository.
"""

from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient

from app import create_app
from blink.config import Settings
from blink.limits import RateLimiter
from blink.store import LocalDirStore, MemoryStore, StoreError, check_key


@pytest.fixture()
def client():
    return TestClient(create_app(Settings(profile="edu", rate_limit_per_minute=10_000)))


def test_health_says_edu_local_synthetic(client):
    h = client.get("/api/health").json()
    assert h["contractVersion"] == "blink-4.0/1" and h["profile"] == "edu" and h["dataSource"] == "LOCAL"
    assert h["storeReachable"] is True and h["realDataEnabled"] is False and h["servePixels"] is True
    assert h["sequenceCount"] == 3 and h["manifestVersion"] == "edu-1" and h["problem"] is None
    assert "dataDir" not in h and "path" not in str(h).lower()            # no store layout in a public answer


def test_list_is_paginated_and_capped():
    c = TestClient(create_app(Settings(profile="edu", max_page_size=2, rate_limit_per_minute=10_000)))
    page = c.get("/api/sequences?limit=500").json()
    assert page["total"] == 3 and page["limit"] == 2 and len(page["sequences"]) == 2
    rest = c.get("/api/sequences?limit=2&offset=2").json()
    assert len(rest["sequences"]) == 1 and rest["offset"] == 2
    assert all(s["dataKind"] == "synthetic" and s["passCount"] == 4 and s["frameCount"] == 12 for s in page["sequences"] + rest["sequences"])
    assert c.get("/api/sequences?limit=0").status_code == 400


def test_sequence_and_pixels_match_the_bundle(client):
    seq = client.get("/api/sequences/syn-a-d2").json()
    assert seq["dataKind"] == "synthetic" and seq["pixelsServed"] is True and len(seq["frames"]) == 12
    assert seq["grid"]["n"] == 49 and seq["grid"]["crpix"] == [25.0, 25.0] and seq["unit"] is None
    f = seq["frames"][3]
    assert f["dataUrl"].endswith("/api/sequences/syn-a-d2/frames/f003/data") and f["dataUrl"].startswith("http")
    assert f["provenance"]["headerCheck"] == "synthetic" and f["provenance"]["generator"]["seed"] == 4101
    data = client.get("/api/sequences/syn-a-d2/frames/f003/data")
    assert data.status_code == 200 and len(data.content) == 4 * 49 * 49
    assert hashlib.sha256(data.content).hexdigest() == f["sha256Pixels"]          # numerical pixels, byte for byte
    mask = client.get("/api/sequences/syn-a-d2/frames/f003/mask")
    assert mask.status_code == 200 and len(mask.content) == 49 * 49 and set(mask.content) == {0}


def test_candidates_come_from_the_store(client):
    c = client.get("/api/sequences/syn-c-d4/candidates").json()
    assert c["algorithm"] == "movers-2" and c["dataKind"] == "synthetic" and len(c["candidates"]) == 2
    assert "never a discovery" in c["note"]


def test_unknown_things_are_404_with_detail(client):
    for url in ("/api/sequences/nope", "/api/sequences/nope/candidates", "/api/sequences/nope/frames/f000/data",
                "/api/sequences/..%2F..%2Fsecret", "/api/nothing"):
        r = client.get(url)
        assert r.status_code == 404 and "detail" in r.json(), url
    r = client.get("/api/sequences/syn-a-d2/frames/f999/data")
    assert r.status_code == 404 and "frame" in r.json()["detail"]


def test_cutouts_compatibility_route(client):
    frames = client.get("/api/cutouts?ra=136.5&dec=16.6&fov=5&det=D2").json()["frames"]
    assert len(frames) == 12 and {"mjd", "dateISO", "detector", "wavelengthMinUm", "wavelengthMaxUm", "dataUrl", "maskUrl", "pixelScaleArcsec", "unit", "flags"} <= set(frames[0])
    assert client.get("/api/cutouts?ra=10&dec=10").json() == {"frames": []}       # as 3.0: an empty list, not an error
    assert client.get("/api/cutouts?ra=136.5&dec=16.6&det=D6").json() == {"frames": []}
    bad = client.get("/api/cutouts?ra=400&dec=0")
    assert bad.status_code == 400 and "ra" in bad.json()["detail"]


def test_edu_never_serves_a_real_sequence(tmp_path):
    """Whatever is put in the bundle folder, the edu profile lists synthetic sequences only."""
    import json, shutil
    src = Settings().edu_bundle_dir
    shutil.copytree(src, tmp_path / "edu")
    doc_path = tmp_path / "edu" / "sequences" / "syn-b-d2" / "sequence.json"
    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    doc["dataKind"] = "real"
    for f in doc["frames"]:
        f["dataKind"] = "real"
    doc_path.write_text(json.dumps(doc), encoding="utf-8")
    c = TestClient(create_app(Settings(profile="edu", edu_bundle_dir=tmp_path / "edu", rate_limit_per_minute=10_000)))
    assert c.get("/api/sequences/syn-b-d2").status_code == 404
    h = c.get("/api/health").json()
    assert h["sequenceCount"] == 2 and "not synthetic" in h["problem"]


def test_missing_bundle_is_reported_not_hidden(tmp_path):
    c = TestClient(create_app(Settings(profile="edu", edu_bundle_dir=tmp_path / "nowhere", rate_limit_per_minute=10_000)))
    h = c.get("/api/health").json()
    assert h["storeReachable"] is False and h["problem"] and h["sequenceCount"] == 0
    assert str(tmp_path) not in str(h)                                              # the sentence does not leak a path
    assert c.get("/api/sequences").json()["total"] == 0


def test_rate_limit_returns_429():
    c = TestClient(create_app(Settings(profile="edu", rate_limit_per_minute=3)))
    codes = [c.get("/api/health").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    r = c.get("/api/health")
    assert r.json()["detail"].startswith("Too many requests") and r.headers["retry-after"] == "60"


def test_rate_limiter_window_resets():
    now = [0.0]
    rl = RateLimiter(2, clock=lambda: now[0])
    assert [rl.allow("a"), rl.allow("a"), rl.allow("a"), rl.allow("b")] == [True, True, False, True]
    now[0] = 61
    assert rl.allow("a") is True


def test_request_size_caps(client):
    assert client.get("/api/sequences?x=" + "a" * 3000).status_code == 414
    assert client.post("/api/admin/reload", content=b"x" * 5000).status_code == 413


def test_cors_is_an_allow_list():
    c = TestClient(create_app(Settings(profile="edu", cors_origins=("https://blink.example.org",), rate_limit_per_minute=10_000)))
    ok = c.get("/api/health", headers={"Origin": "https://blink.example.org"})
    assert ok.headers.get("access-control-allow-origin") == "https://blink.example.org"
    other = c.get("/api/health", headers={"Origin": "https://elsewhere.example.org"})
    assert "access-control-allow-origin" not in other.headers
    with pytest.raises(ValueError):
        Settings.from_env({"CORS_ALLOW_ORIGINS": "*"})


def test_admin_is_disabled_without_a_token_and_refuses_a_wrong_one(client):
    assert client.post("/api/admin/reload").status_code == 403
    c = TestClient(create_app(Settings(profile="edu", admin_token="test-only-token", rate_limit_per_minute=10_000)))
    assert c.post("/api/admin/reload").status_code == 403
    assert c.post("/api/admin/reload", headers={"Authorization": "Bearer wrong"}).status_code == 403
    assert c.post("/api/admin/reload", headers={"Authorization": "Bearer test-only-token"}).json()["reloaded"] is True
    assert "test-only-token" not in repr(Settings(admin_token="test-only-token"))    # a token is never printed


def test_settings_defaults_are_the_safe_ones():
    s = Settings.from_env({})
    assert s.profile == "edu" and s.real_data_enabled is False and s.serve_pixels is False and s.admin_token == "" and s.gcs_bucket == ""
    full = Settings.from_env({"BLINK_PROFILE": "full", "GCS_BUCKET": "b", "REAL_DATA_ENABLED": "true"})
    assert full.data_source == "CLOUD" and full.real_data_enabled is True and full.serve_pixels is False
    with pytest.raises(ValueError):
        Settings.from_env({"BLINK_PROFILE": "other"})


def test_store_keys_cannot_escape(tmp_path):
    for bad in ("../x", "/etc/passwd", "a/../../b", "a\\b", "", "a//b", "fields/../x"):
        with pytest.raises(StoreError):
            check_key(bad)
    store = LocalDirStore(tmp_path)
    store.put("fields/f1/manifest.json", b'{"manifestVersion": "v1"}')
    assert store.exists("fields/f1/manifest.json") and store.list_fields() == ["f1"] and store.get_manifest("f1")["manifestVersion"] == "v1"
    assert store.checksum("fields/f1/manifest.json") == hashlib.sha256(b'{"manifestVersion": "v1"}').hexdigest()
    assert b"".join(store.open_frame("f1", "manifest.json")) == b'{"manifestVersion": "v1"}'
    assert not store.exists("../outside") and not list(tmp_path.glob("**/*.part"))


def test_memory_store_behaves_like_a_store():
    m = MemoryStore()
    m.put("fields/a/manifest.json", b"{}")
    m.put("fields/a/originals/x.bin", b"abc" * 100_000)
    assert m.list_fields() == ["a"] and m.size("fields/a/originals/x.bin") == 300_000
    assert sum(1 for _ in m.open("fields/a/originals/x.bin")) == 2               # streamed in chunks
    m.down = "The store cannot be reached."
    assert m.reachable() == (False, "The store cannot be reached.")
    with pytest.raises(StoreError):
        m.read("fields/a/manifest.json")
