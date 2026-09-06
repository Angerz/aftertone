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
