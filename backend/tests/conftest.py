"""Process-wide test isolation.

This module is imported by pytest before test modules are collected.  Keeping
the database URL here prevents a domain-only test from importing ``app`` first
and accidentally letting an API fixture operate on a developer's local SQLite
database.
"""

from __future__ import annotations

import os
from pathlib import Path


TESTS_DIR = Path(__file__).parent
os.environ["AFTERTONE_DATABASE_URL"] = f"sqlite:///{TESTS_DIR / 'aftertone-api-test.sqlite3'}"
os.environ["AFTERTONE_COVER_DIR"] = str(TESTS_DIR / ".test-covers")
