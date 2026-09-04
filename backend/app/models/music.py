from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReleaseType(str, enum.Enum):
    ALBUM = "album"
    EP = "ep"
    MIXTAPE = "mixtape"
    COMPILATION = "compilation"


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    artist: Mapped[str] = mapped_column(String(300))
    release_type: Mapped[ReleaseType] = mapped_column(
        Enum(ReleaseType, values_callable=lambda enum: [item.value for item in enum]), default=ReleaseType.ALBUM
    )
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_filename: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tracks: Mapped[list[Track]] = relationship(back_populates="album", cascade="all, delete-orphan")
    revisions: Mapped[list[RatingRevision]] = relationship(back_populates="album", cascade="all, delete-orphan")


class Track(Base):
    __tablename__ = "tracks"
    __table_args__ = (UniqueConstraint("album_id", "position", name="uq_track_album_position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    album: Mapped[Album] = relationship(back_populates="tracks")


class RatingRevision(Base):
    __tablename__ = "rating_revisions"
    __table_args__ = (
        CheckConstraint("coherence >= 0 AND coherence <= 10", name="ck_revision_coherence_range"),
        CheckConstraint("emotion >= 0 AND emotion <= 10", name="ck_revision_emotion_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    coherence: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    coherence_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    emotion: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    emotion_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    album_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    pre_rating: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    bad_experience: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)
    final_rating: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)

    album: Mapped[Album] = relationship(back_populates="revisions")
    track_ratings: Mapped[list[TrackRatingRevision]] = relationship(
        back_populates="revision", cascade="all, delete-orphan"
    )


class TrackRatingRevision(Base):
    __tablename__ = "track_rating_revisions"
    __table_args__ = (
        UniqueConstraint("rating_revision_id", "track_id", name="uq_revision_track"),
        CheckConstraint("score >= 0 AND score <= 10", name="ck_track_rating_score_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    rating_revision_id: Mapped[int] = mapped_column(ForeignKey("rating_revisions.id", ondelete="CASCADE"))
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id", ondelete="RESTRICT"))
    track_title: Mapped[str] = mapped_column(String(300))
    track_position: Mapped[int] = mapped_column(Integer)
    score: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    include_in_pre_rating: Mapped[bool] = mapped_column(default=True)

    revision: Mapped[RatingRevision] = relationship(back_populates="track_ratings")
