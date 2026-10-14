from __future__ import annotations

import os
from pathlib import Path


def database_url() -> str:
    return os.getenv("AFTERTONE_DATABASE_URL", "sqlite:///./aftertone.sqlite3")


def web_origin() -> str:
    """The configured local web origin permitted to call the API during development."""
    return os.getenv("AFTERTONE_WEB_ORIGIN", "http://127.0.0.1:5177")


def web_origins() -> list[str]:
    """Allow the equivalent loopback hostname without broadening CORS access."""
    origin = web_origin()
    if origin.startswith("http://127.0.0.1:"):
        return [origin, origin.replace("127.0.0.1", "localhost", 1)]
    if origin.startswith("http://localhost:"):
        return [origin, origin.replace("localhost", "127.0.0.1", 1)]
    return [origin]


def cover_dir() -> Path:
    return Path(os.getenv("AFTERTONE_COVER_DIR", "./data/covers"))


def production() -> bool:
    return os.getenv("AFTERTONE_ENV", "development") == "production"


def validate_configuration() -> None:
    from argon2 import extract_parameters
    from argon2.low_level import Type

    if os.getenv("AFTERTONE_ENV", "development") not in {"development", "production"}:
        raise RuntimeError("AFTERTONE_ENV must be development or production.")
    lifetime = int(os.getenv("AFTERTONE_SESSION_SECONDS", "43200"))
    if not 300 <= lifetime <= 604800:
        raise RuntimeError("AFTERTONE_SESSION_SECONDS must be between 300 and 604800.")
    configured = os.getenv("AFTERTONE_OWNER_PASSWORD_HASH", "")
    if configured:
        params = extract_parameters(configured)
        if params.type != Type.ID or params.memory_cost < 19456 or params.time_cost < 2:
            raise RuntimeError("Owner hash must use Argon2id with sufficient work factors.")
    if production():
        if not configured:
            raise RuntimeError("Production requires AFTERTONE_OWNER_PASSWORD_HASH.")
        from urllib.parse import urlsplit

        origin = urlsplit(web_origin())
        if (
            origin.scheme != "https"
            or not origin.hostname
            or origin.path
            or origin.query
            or origin.fragment
            or origin.username
        ):
            raise RuntimeError("Production requires an HTTPS AFTERTONE_WEB_ORIGIN without a path.")
        if not database_url().startswith("sqlite:////") or not cover_dir().is_absolute():
            raise RuntimeError(
                "Production SQLite and media paths must be absolute persistent paths."
            )
