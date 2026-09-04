from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import database_url


class Base(DeclarativeBase):
    pass


engine = create_engine(database_url())
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

