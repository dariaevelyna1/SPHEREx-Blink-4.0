"""Configuration from environment variables only (see .env.example). No file with a secret is ever read."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent

_TRUE = {"1", "true", "yes", "on"}


def _flag(env: Mapping[str, str], name: str, default: bool = False) -> bool:
    value = env.get(name)
    return default if value is None or value.strip() == "" else value.strip().lower() in _TRUE


def _number(env: Mapping[str, str], name: str, default: float, lo: float, hi: float) -> float:
    try:
        value = float(env.get(name, "") or default)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc
    if not lo <= value <= hi:
        raise ValueError(f"{name} must be between {lo} and {hi}")
    return value


def _path(env: Mapping[str, str], name: str, default: Path) -> Path:
    value = (env.get(name) or "").strip()
    path = Path(value) if value else default
    return path if path.is_absolute() else (REPO_DIR / path)


@dataclass(frozen=True)
class Settings:
    profile: str = "edu"                                   # "edu" | "full"
    edu_bundle_dir: Path = REPO_DIR / "frontend" / "data" / "edu"
    data_dir: Path = BACKEND_DIR / "data" / "store"        # LocalDirStore root (full profile, when no bucket is set)
    gcs_bucket: str = ""
    gcs_prefix: str = ""
    gcp_project: str = ""
    cache_dir: Path = BACKEND_DIR / ".cache"
    cache_max_mb: int = 256
    real_data_enabled: bool = False                        # decision 1 and 4: the author's
    serve_pixels: bool = False
    approved_file: Path = BACKEND_DIR / "approved_sequences.json"
    cors_origins: tuple[str, ...] = ("http://localhost:8765",)
    rate_limit_per_minute: int = 60
    max_concurrent: int = 8
    request_timeout_s: float = 20.0
    max_page_size: int = 50
    trust_forwarded_for: bool = False                      # behind a proxy the client address is in X-Forwarded-For; trust it only there
    admin_token: str = field(default="", repr=False)       # never printed, never logged

    @property
    def data_source(self) -> str:
        if self.profile == "edu":
            return "LOCAL"
        return "CLOUD" if self.gcs_bucket else "LOCAL"

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Settings":
        env = os.environ if env is None else env
        profile = (env.get("BLINK_PROFILE") or "edu").strip().lower()
        if profile not in ("edu", "full"):
            raise ValueError('BLINK_PROFILE must be "edu" or "full"')
        origins = tuple(o.strip().rstrip("/") for o in (env.get("CORS_ALLOW_ORIGINS") or "http://localhost:8765").split(",") if o.strip())
        if "*" in origins:
            raise ValueError("CORS_ALLOW_ORIGINS must be a list of origins, not *")
        return cls(
            profile=profile,
            edu_bundle_dir=_path(env, "EDU_BUNDLE_DIR", cls.edu_bundle_dir),
            data_dir=_path(env, "SPHEREX_DATA_DIR", cls.data_dir),
            gcs_bucket=(env.get("GCS_BUCKET") or "").strip(),
            gcs_prefix=(env.get("GCS_PREFIX") or "").strip().strip("/"),
            gcp_project=(env.get("GOOGLE_CLOUD_PROJECT") or "").strip(),
            cache_dir=_path(env, "BLINK_CACHE_DIR", cls.cache_dir),
            cache_max_mb=int(_number(env, "BLINK_CACHE_MAX_MB", 256, 0, 100_000)),
            real_data_enabled=_flag(env, "REAL_DATA_ENABLED"),
            serve_pixels=_flag(env, "SERVE_PIXELS"),
            approved_file=_path(env, "APPROVED_SEQUENCES_FILE", cls.approved_file),
            cors_origins=origins,
            rate_limit_per_minute=int(_number(env, "RATE_LIMIT_PER_MINUTE", 60, 1, 100_000)),
            max_concurrent=int(_number(env, "MAX_CONCURRENT_REQUESTS", 8, 1, 1000)),
            request_timeout_s=_number(env, "REQUEST_TIMEOUT_SECONDS", 20, 0.05, 600),
            max_page_size=int(_number(env, "MAX_PAGE_SIZE", 50, 1, 500)),
            trust_forwarded_for=_flag(env, "TRUST_FORWARDED_FOR"),
            admin_token=(env.get("ADMIN_TOKEN") or "").strip(),
        )
