from __future__ import annotations

import os
from pathlib import Path


def database_url() -> str:
    return os.getenv("AFTERTONE_DATABASE_URL", "sqlite:///./aftertone.sqlite3")


def web_origin() -> str:
    """The sole local web origin permitted to call the API during development."""
    return os.getenv("AFTERTONE_WEB_ORIGIN", "http://127.0.0.1:5177")


def cover_dir() -> Path:
    return Path(os.getenv("AFTERTONE_COVER_DIR", "./data/covers"))
