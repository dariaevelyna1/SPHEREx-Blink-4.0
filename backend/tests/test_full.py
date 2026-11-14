"""The full profile, tested with FAKES only: a fake Google Cloud Storage client, a fake archive, a memory store, and FITS files written by the
test into a temporary folder (synthetic, never committed). No network, no cloud account, no real data.

    retrieval   archive -> store      (blink/archive/retrieve.py)
    processing  store -> products     (blink/processing/job.py, reusing 3.0's modules unchanged)
    storage     GcsStore, CachedStore, LocalDirStore, MemoryStore
    serving     the full profile of app.py: allow-list, REAL_DATA_ENABLED, SERVE_PIXELS
"""

from __future__ import annotations

import hashlib
import io
import json
import shutil
from pathlib import Path

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient

from app import create_app
from blink.approved import Approved
from blink.archive.retrieve import FakeArchive, RetrievalError, check_url, retrieve, main as retrieve_main
from blink.config import Settings
from blink.manifest import build_manifest
from blink.processing.job import ProcessingError, node_detector, process
from blink.store import LocalDirStore, MemoryStore, StoreError
from blink.store.cache import CachedStore
from blink.store.gcs import GcsStore

REUSED = Path(__file__).resolve().parents[1] / "blink" / "processing" / "reused"
URL = "https://irsa.ipac.caltech.edu/test/{}.fits"          # a URL shape for the fake archive only; never fetched
RA, DEC, SCALE = 150.0, 2.0, 6.14


# ----------------------------------------------------------------- reused 3.0 modules are unchanged
@pytest.mark.parametrize("name,sha", [
    ("flags.py", "939a564e87747fce46f2a088bd5b02dddcd5abb9da083bd339caaa7492ad6ba6"),
    ("floatdata.py", "4342e9685affb1dfe80b03d41d147b8eee75df3f93d259fcddd610770ae5ead0"),
    ("cutout.py", "2fcadc94bd1ff10559b4ea720156d7b67615daff37f87913d6bc7939165e4fed"),
    ("query.py", "9cd77c18e7a860f4c3e4197f01555e3d13a1b7f5ad6740d5eb656bf029ccefdc"),
])
def test_reused_modules_are_byte_identical_to_3_0(name, sha):
    assert hashlib.sha256((REUSED / name).read_bytes()).hexdigest() == sha


# ----------------------------------------------------------------- synthetic FITS fixtures (made here, never committed)
def make_fits(mjd: float, *, rot_deg: float, mover_offset_arcsec: tuple[float, float], seed: int, synthetic_comment: bool = False,
              n: int = 90, flag_centre: bool = False) -> bytes:
    """A small SPHEREx-like file: HDU 1 IMAGE (float32, rotated TAN WCS), HDU 2 FLAGS (int32). Stars fixed on the sky, one mover."""
    rng = np.random.default_rng(seed)
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [RA, DEC]
    w.wcs.crpix = [(n + 1) / 2, (n + 1) / 2]
    s, t = SCALE / 3600, np.radians(rot_deg)
    w.wcs.cd = [[-s * np.cos(t), s * np.sin(t)], [s * np.sin(t), s * np.cos(t)]]
    img = rng.normal(0, 1, (n, n)).astype(np.float64) + 50.0
    yy, xx = np.mgrid[0:n, 0:n]
    star_rng = np.random.default_rng(7)                       # the same stars in every file
    stars = [(RA + star_rng.uniform(-0.06, 0.06), DEC + star_rng.uniform(-0.06, 0.06), star_rng.uniform(60, 200)) for _ in range(14)]
    mra = RA - 0.025 + mover_offset_arcsec[0] / 3600 / np.cos(np.radians(DEC))
    mdec = DEC + 0.02 + mover_offset_arcsec[1] / 3600
    for ra, dec, flux in stars + [(mra, mdec, 160.0)]:
        px, py = w.all_world2pix([[ra, dec]], 0)[0]
        img += flux / (2 * np.pi * 0.6 ** 2) * np.exp(-((xx - px) ** 2 + (yy - py) ** 2) / (2 * 0.6 ** 2))
    flags = np.zeros((n, n), dtype=np.int32) | (1 << 21)    # bit 21 everywhere, as on real files (informative, not BAD)
    if flag_centre:
        flags[n // 2, n // 2] |= 1 << 10
    hdr = w.to_header()
    hdr["MJD-OBS"] = mjd
    hdr["DETECTOR"] = 2
    hdr["BUNIT"] = "MJy / sr"
    hdr["WAVEMIN"], hdr["WAVEMAX"] = 1.30, 1.34
    if synthetic_comment:
        hdr["COMMENT"] = "SYNTHETIC TEST FILE"
    else:
        hdr["OBSID"], hdr["SPS_TARGET"], hdr["EXTTYPE"] = f"TEST{seed}", "TEST", "IMAGE"
    hdul = fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(img.astype(np.float32), header=hdr, name="IMAGE"), fits.ImageHDU(flags, name="FLAGS")])
    buf = io.BytesIO()
    hdul.writeto(buf)
    return buf.getvalue()


MJDS = [60900 + p * 183 + k * 0.1 for p in range(4) for k in range(3)]       # 4 passes of 3 frames, half a year apart
SPEED = (40.0, -25.0)                                                           # arcsec/yr (east, north) of the mover


@pytest.fixture(scope="module")
def originals() -> dict[str, bytes]:
    out = {}
    for i, mjd in enumerate(MJDS):
        yr = (mjd - MJDS[0]) / 365.25
        out[f"t{i:02d}.fits"] = make_fits(mjd, rot_deg=10 * (i % 4) - 15, mover_offset_arcsec=(SPEED[0] * yr, SPEED[1] * yr), seed=100 + i)
    return out


def plan_for(files: dict[str, bytes], *, with_sha: bool = True) -> dict:
    return {"fieldId": "test-field", "sequenceId": "test-field-d2", "center": {"raDeg": RA, "decDeg": DEC}, "fovArcmin": 6,
            "files": [{"sourceUrl": URL.format(name[:-5]), "fileName": name, **({"sha256": hashlib.sha256(b).hexdigest()} if with_sha else {})}
                      for name, b in files.items()]}


APPROVED = [Approved("test-field-d2", "test-field", terms_checked=True)]
NOW = lambda: "2026-11-14T12:00:00Z"  # noqa: E731


def fake_archive(files: dict[str, bytes]) -> FakeArchive:
    return FakeArchive({URL.format(name[:-5]): b for name, b in files.items()})


# ----------------------------------------------------------------- storage: GcsStore with a fake client
class FakeBlob:
    def __init__(self, bucket, name):
        self.bucket, self.name = bucket, name

    def exists(self):
        self.bucket.check()
        return self.name in self.bucket.objects

    def open(self, mode, chunk_size=None):
        self.bucket.check()
        if self.name not in self.bucket.objects:
            raise FileNotFoundError(self.name)
        return io.BytesIO(self.bucket.objects[self.name])

    def upload_from_string(self, data, content_type=None):
        self.bucket.check()
        self.bucket.objects[self.name] = bytes(data)


class FakeBucket:
    def __init__(self):
        self.objects, self.broken = {}, False

    def check(self):
        if self.broken:
            raise RuntimeError("403 secret-bucket-name permission denied")

    def blob(self, name):
        return FakeBlob(self, name)

    def list_blobs(self, prefix=None, max_results=None):
        self.check()
        names = sorted(n for n in self.objects if n.startswith(prefix or ""))
        return [FakeBlob(self, n) for n in names[:max_results] if True]


class FakeClient:
    def __init__(self):
        self.buckets = {}

    def bucket(self, name):
        return self.buckets.setdefault(name, FakeBucket())


def test_gcs_store_reads_writes_under_its_prefix():
    client = FakeClient()
    store = GcsStore("secret-bucket-name", "blink/v1", client=client)
    store.put("fields/a/manifest.json", b'{"x": 1}')
    store.put("fields/a/originals/o.fits", b"x" * 600_000)
    assert set(client.buckets["secret-bucket-name"].objects) == {"blink/v1/fields/a/manifest.json", "blink/v1/fields/a/originals/o.fits"}
    assert store.exists("fields/a/manifest.json") and not store.exists("fields/b/manifest.json")
    assert store.list("fields/") == ["fields/a/manifest.json", "fields/a/originals/o.fits"]
    assert store.list_fields() == ["a"] and store.get_manifest("a") == {"x": 1}
    chunks = list(store.open("fields/a/originals/o.fits"))
    assert len(chunks) > 1 and b"".join(chunks) == b"x" * 600_000                   # streamed in chunks
    assert store.checksum("fields/a/originals/o.fits") == hashlib.sha256(b"x" * 600_000).hexdigest()
    assert store.reachable() == (True, None) and store.kind == "CLOUD"
    with pytest.raises(StoreError):
        store.put("../escape", b"")
    with pytest.raises(StoreError):
        list(store.open("fields/none"))


def test_gcs_store_failure_says_nothing_about_the_bucket():
    client = FakeClient()
    store = GcsStore("secret-bucket-name", "p", client=client)
    client.buckets["secret-bucket-name"].broken = True
    ok, why = store.reachable()
    assert ok is False and "secret" not in why and "403" not in why
    with pytest.raises(StoreError) as exc:
        store.put("a", b"1")
    assert "secret" not in str(exc.value)


# ----------------------------------------------------------------- storage: the read-through cache
def test_cache_reads_once_and_stays_under_its_cap(tmp_path):
    inner = MemoryStore({f"k{i}": bytes([i]) * 400_000 for i in range(5)}, kind="CLOUD")
    cache = CachedStore(inner, tmp_path / "cache", max_mb=1)
    assert b"".join(cache.open("k0")) == bytes([0]) * 400_000
    assert b"".join(cache.open("k0")) == bytes([0]) * 400_000
    assert inner.reads.count("k0") == 1                                              # the second read came from the cache
    for i in range(1, 5):
        b"".join(cache.open(f"k{i}"))
    assert cache.cached_bytes() <= 1024 * 1024                                       # least recently used evicted
    cache.put("k4", b"new")
    assert b"".join(cache.open("k4")) == b"new"                                      # a write invalidates the cached copy
    assert cache.kind == "CLOUD"
    cache.clear()
    assert cache.cached_bytes() == 0


def test_cache_streams_objects_too_big_to_cache(tmp_path):
    inner = MemoryStore({"big": b"z" * 3_000_000})
    cache = CachedStore(inner, tmp_path / "c", max_mb=10, max_object_mb=1)
    assert b"".join(cache.open("big")) == b"z" * 3_000_000 and cache.cached_bytes() == 0


# ----------------------------------------------------------------- retrieval: archive -> store
def test_retrieval_refuses_what_is_not_approved_or_not_the_archive(originals):
    store, files = MemoryStore(), dict(list(originals.items())[:2])
    with pytest.raises(RetrievalError, match="not in the approved"):
        retrieve(plan_for(files), store, fake_archive(files), [], now=NOW)
    bad = plan_for(files)
    bad["files"][0]["sourceUrl"] = "http://irsa.ipac.caltech.edu/x.fits"
    with pytest.raises(RetrievalError, match="refused URL"):
        retrieve(bad, store, fake_archive(files), APPROVED, now=NOW)
    for url in ("https://evil.example.com/x.fits", "https://user:pw" + "@" + "irsa.ipac.caltech.edu/x.fits", "file:///etc/passwd"):
        with pytest.raises(RetrievalError):
            check_url(url)
    traversal = plan_for(files)
    traversal["files"][0]["fileName"] = "../x.fits"
    with pytest.raises(RetrievalError):
        retrieve(traversal, store, fake_archive(files), APPROVED, now=NOW)
    assert store.objects == {}


def test_retrieval_stores_verified_files_and_writes_the_manifest(originals):
    store, archive = MemoryStore(), fake_archive(originals)
    m = retrieve(plan_for(originals), store, archive, APPROVED, now=NOW, log=lambda *_: None)
    assert len(m["originals"]) == 12 and m["fieldId"] == "test-field" and m["manifestVersion"] == NOW()
    first = m["originals"][0]
    data = originals[first["archive"]["fileName"]]
    assert first["sha256"] == hashlib.sha256(data).hexdigest() and first["sizeBytes"] == len(data)
    assert first["detector"] == "D2" and abs(first["mjd"] - MJDS[0]) < 1e-6 and first["timeKeyword"] == "MJD-OBS"
    assert first["headerCheck"] == "spherex_header" and first["archive"]["sha256CheckedAgainstPlan"] is True
    assert [o["frameId"] for o in m["originals"]] == [f"o{i:03d}" for i in range(12)]
    assert store.read(f"fields/test-field/{first['path']}") == data                     # byte-identical to the archive
    n = len(archive.fetched)
    retrieve(plan_for(originals), store, archive, APPROVED, now=NOW, log=lambda *_: None)
    assert len(archive.fetched) == n                                                   # a second run fetches nothing already stored


def test_retrieval_refuses_a_checksum_mismatch_and_stores_nothing(originals):
    files = dict(list(originals.items())[:1])
    plan = plan_for(files)
    plan["files"][0]["sha256"] = "0" * 64
    store = MemoryStore()
    with pytest.raises(RetrievalError, match="differs"):
        retrieve(plan, store, fake_archive(files), APPROVED, now=NOW)
    assert store.objects == {}


def test_retrieval_refuses_a_synthetic_test_file(originals):
    fake = {"s.fits": make_fits(60900, rot_deg=0, mover_offset_arcsec=(0, 0), seed=1, synthetic_comment=True)}
    store = MemoryStore()
    with pytest.raises(RetrievalError, match="synthetic"):
        retrieve(plan_for(fake), store, fake_archive(fake), APPROVED, now=NOW)
    assert store.objects == {}


def test_retrieval_cli_is_a_dry_run_without_confirmation(tmp_path, monkeypatch, capsys, originals):
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps(plan_for(dict(list(originals.items())[:1]))))
    approved = tmp_path / "approved.json"
    approved.write_text(json.dumps({"approved": [{"sequenceId": "test-field-d2", "fieldId": "test-field"}]}))
    monkeypatch.setenv("BLINK_PROFILE", "full")
    monkeypatch.setenv("SPHEREX_DATA_DIR", str(tmp_path / "store"))
    monkeypatch.setenv("APPROVED_SEQUENCES_FILE", str(approved))
    import sys
    r = sys.modules["blink.archive.retrieve"]                      # the module (the package re-exports a function of the same name)
    monkeypatch.setattr(r, "HttpsArchive", lambda *a, **k: pytest.fail("the dry run must not create an archive client"))
    assert retrieve_main(["--plan", str(plan)]) == 0
    assert "dry run" in capsys.readouterr().out and not (tmp_path / "store").exists()


# ----------------------------------------------------------------- the manifest builder (local originals, no network)
def test_manifest_builder_hashes_and_reads_local_files(tmp_path, originals):
    folder = tmp_path / "fields" / "test-field" / "originals"
    folder.mkdir(parents=True)
    for name, b in list(originals.items())[:3]:
        (folder / name).write_bytes(b)
    (folder / "notes.txt").write_text("ignored")
    m = build_manifest(tmp_path, "test-field", RA, DEC, 6, now="2026-11-14T00:00:00Z")
    assert [o["path"] for o in m["originals"]] == ["originals/t00.fits", "originals/t01.fits", "originals/t02.fits"]
    assert m["originals"][0]["sha256"] == hashlib.sha256(originals["t00.fits"]).hexdigest()
    assert m["originals"][0]["archive"]["sourceUrl"] is None                          # never a guessed URL
    assert json.loads((tmp_path / "fields/test-field/manifest.json").read_text())["fieldId"] == "test-field"
    with pytest.raises(ValueError):
        build_manifest(tmp_path, "no-such-field", RA, DEC, 6)


# ----------------------------------------------------------------- processing: store -> products
@pytest.fixture(scope="module")
def processed(originals):
    store = MemoryStore(kind="CLOUD")
    retrieve(plan_for(originals), store, fake_archive(originals), APPROVED, now=NOW, log=lambda *_: None)
    seq = process(store, "test-field", "test-field-d2", "D2", now=NOW, candidates=None, log=lambda *_: None)
    return store, seq


def test_processing_writes_a_real_product_with_numbers_and_provenance(processed, originals):
    store, seq = processed
    prefix = "fields/test-field/products/test-field-d2/"
    assert seq["dataKind"] == "real" and "truth" not in seq and seq["pixelsServed"] is False
    assert len(seq["frames"]) == 12 and seq["unit"] == "MJy / sr" and "[unverified]" in seq["terms"]
    n = seq["grid"]["n"]
    assert n == int(np.ceil(6 * 60 / seq["grid"]["pixelScaleArcsec"])) and seq["grid"]["crpix"] == [(n + 1) / 2] * 2
    assert abs(seq["grid"]["pixelScaleArcsec"] - SCALE) < 0.01
    f = seq["frames"][0]
    data = store.read(prefix + "frames/f000.f32")
    assert len(data) == 4 * n * n and hashlib.sha256(data).hexdigest() == f["sha256Pixels"]
    assert len(store.read(prefix + "frames/f000.mask.u8")) == n * n
    assert f["provenance"]["origin"] == "archive" and f["provenance"]["archive"]["sha256"] == hashlib.sha256(originals["t00.fits"]).hexdigest()
    assert f["provenance"]["headerCheck"] == "spherex_header" and f["wavelengthSource"] == "header" and f["timeKeyword"] == "MJD-OBS"
    assert f["flags"] == {"anyFlagged": False, "fractionFlagged": 0.0}                # bit 21 is informative, not BAD
    # The injected noise sigma is 1 per ORIGINAL pixel. Bilinear resampling averages up to 4 neighbours, so the product's noise is lower
    # (0.67 measured here on rotated frames); first written as 0.7-1.4, which expected no smoothing: the expectation was wrong, not the code.
    assert 0.5 < f["stats"]["noiseSigma"] < 1.05
    assert [fr["mjd"] for fr in seq["frames"]] == sorted(fr["mjd"] for fr in seq["frames"])
    assert "reusedFrom" in seq["processing"] and "06ac378" in seq["processing"]["reusedFrom"]
    assert store.get_manifest("test-field")["products"] == ["test-field-d2"]


def test_processing_refuses_tampered_originals(originals):
    store = MemoryStore()
    files = dict(list(originals.items())[:3])
    retrieve(plan_for(files), store, fake_archive(files), APPROVED, now=NOW, log=lambda *_: None)
    key = "fields/test-field/originals/t00.fits"
    store.objects[key] = store.objects[key][:-1] + b"!"
    with pytest.raises(ProcessingError, match="SHA-256"):
        process(store, "test-field", "test-field-d2", "D2", now=NOW, candidates=None, log=lambda *_: None)
    with pytest.raises(ProcessingError, match="no readable original of D5"):
        process(store, "test-field", "test-field-d5", "D5", now=NOW, candidates=None, log=lambda *_: None)


@pytest.mark.skipif(shutil.which("node") is None, reason="Node is not installed")
def test_processing_candidates_find_the_injected_mover(originals):
    store = MemoryStore()
    retrieve(plan_for(originals), store, fake_archive(originals), APPROVED, now=NOW, log=lambda *_: None)
    process(store, "test-field", "test-field-d2", "D2", now=NOW, candidates=node_detector, log=lambda *_: None)
    cand = store.read_json("fields/test-field/products/test-field-d2/candidates.json")
    assert cand["algorithm"] == "movers-2" and cand["dataKind"] == "real" and cand["stats"]["passes"] == 4
    best = min(cand["candidates"], key=lambda c: np.hypot(c["pmEastArcsecPerYr"] - SPEED[0], c["pmNorthArcsecPerYr"] - SPEED[1]))
    assert np.hypot(best["pmEastArcsecPerYr"] - SPEED[0], best["pmNorthArcsecPerYr"] - SPEED[1]) < 3.0      # arcsec/yr


# ----------------------------------------------------------------- serving: the full profile over the processed store
def full_client(store, **kw) -> TestClient:
    settings = Settings(profile="full", gcs_bucket="placeholder", rate_limit_per_minute=10_000, **kw)
    return TestClient(create_app(settings, store=store, approved=kw.pop("approved", None) or APPROVED))


def test_full_profile_serves_real_data_only_when_enabled_and_approved(processed):
    store, _ = processed
    off = TestClient(create_app(Settings(profile="full", gcs_bucket="placeholder", rate_limit_per_minute=10_000), store=store, approved=APPROVED))
    h = off.get("/api/health").json()
    assert h["profile"] == "full" and h["dataSource"] == "CLOUD" and h["realDataEnabled"] is False and h["servePixels"] is False
    assert h["sequenceCount"] == 0 and off.get("/api/sequences/test-field-d2").status_code == 404     # real data off by default
    unchecked = [Approved("test-field-d2", "test-field", terms_checked=False)]
    c = TestClient(create_app(Settings(profile="full", gcs_bucket="p", real_data_enabled=True, rate_limit_per_minute=10_000), store=store, approved=unchecked))
    assert c.get("/api/health").json()["sequenceCount"] == 0                         # terms not checked: still nothing
    none = TestClient(create_app(Settings(profile="full", gcs_bucket="p", real_data_enabled=True, rate_limit_per_minute=10_000), store=store, approved=[]))
    assert none.get("/api/sequences/test-field-d2").status_code == 404               # not approved: does not exist


def test_full_profile_serves_numbers_not_pixels_by_default(processed):
    store, _ = processed
    c = TestClient(create_app(Settings(profile="full", gcs_bucket="p", real_data_enabled=True, rate_limit_per_minute=10_000), store=store, approved=APPROVED))
    assert c.get("/api/health").json()["sequenceCount"] == 1
    seq = c.get("/api/sequences/test-field-d2").json()
    assert seq["dataKind"] == "real" and seq["pixelsServed"] is False and all(f["dataUrl"] is None and f["maskUrl"] is None for f in seq["frames"])
    assert all(len(f["sha256Pixels"]) == 64 for f in seq["frames"])                  # the hash is public, the pixels are not
    r = c.get("/api/sequences/test-field-d2/frames/f000/data")
    assert r.status_code == 403 and "derived numbers only" in r.json()["detail"]
    lst = c.get("/api/sequences").json()
    assert lst["total"] == 1 and lst["sequences"][0]["pixelsServed"] is False and lst["sequences"][0]["passCount"] == 4


def test_full_profile_serves_pixels_only_with_the_flag(processed):
    store, seq = processed
    c = TestClient(create_app(Settings(profile="full", gcs_bucket="p", real_data_enabled=True, serve_pixels=True, rate_limit_per_minute=10_000),
                              store=store, approved=APPROVED))
    r = c.get("/api/sequences/test-field-d2/frames/f003/data")
    assert r.status_code == 200 and hashlib.sha256(r.content).hexdigest() == seq["frames"][3]["sha256Pixels"]


def test_full_profile_reports_an_unreachable_store():
    store = MemoryStore(kind="CLOUD")
    store.down = "The cloud store cannot be reached (permission, network or configuration)."
    h = TestClient(create_app(Settings(profile="full", gcs_bucket="p", rate_limit_per_minute=10_000), store=store, approved=APPROVED)).get("/api/health").json()
    assert h["storeReachable"] is False and h["problem"] and h["sequenceCount"] == 0


def test_admin_reload_clears_the_cache_and_needs_the_token(tmp_path, processed):
    store, _ = processed
    cache = CachedStore(store, tmp_path / "c", max_mb=50)
    c = TestClient(create_app(Settings(profile="full", gcs_bucket="p", real_data_enabled=True, admin_token="t0k3n-for-tests", rate_limit_per_minute=10_000),
                              store=cache, approved=APPROVED))
    c.get("/api/sequences/test-field-d2/candidates")
    assert c.post("/api/admin/reload").status_code == 403
    assert c.post("/api/admin/reload", headers={"Authorization": "Bearer wrong"}).status_code == 403
    assert cache.cached_bytes() > 0
    assert c.post("/api/admin/reload", headers={"Authorization": "Bearer t0k3n-for-tests"}).status_code == 200
    assert cache.cached_bytes() == 0
