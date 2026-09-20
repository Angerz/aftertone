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
    connect_args={"check_same_thread": False} if _database_url.startswith("sqlite") else {},
)
if _database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def register_search_normalization(connection, _connection_record) -> None:
        connection.create_function("search_normalize", 1, normalize_search_text)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
