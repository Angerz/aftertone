from __future__ import annotations

import os


def database_url() -> str:
    return os.getenv("AFTERTONE_DATABASE_URL", "sqlite:///./aftertone.sqlite3")

