from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import database_url
from app.services.search import normalize_search_text


class Base(DeclarativeBase):
    pass


_database_url = database_url()
engine = create_engine(
    _database_url,
    connect_args={"check_same_thread": False, "timeout": 15}
    if _database_url.startswith("sqlite")
    else {},
)
if _database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def register_search_normalization(connection, _connection_record) -> None:
        connection.create_function("search_normalize", 1, normalize_search_text)
        connection.execute("PRAGMA busy_timeout=15000")
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
