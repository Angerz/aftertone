from __future__ import annotations

from collections.abc import Generator

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.config import web_origin
from app.models.music import Album, RatingRevision, Track
from app.schemas.music import (
    AlbumCreate,
    AlbumResponse,
    LatestRevisionResponse,
    RatingRevisionCreate,
    RatingRevisionResponse,
    RatingRevisionSummaryResponse,
    TrackRatingRevisionResponse,
    TrackResponse,
)
from app.services.rating_revisions import RevisionTracksError, create_rating_revision

app = FastAPI(title="Aftertone API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[web_origin()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def album_response(album: Album, latest_revision: RatingRevision | None = None) -> AlbumResponse:
    return AlbumResponse(
        id=album.id, title=album.title, artist=album.artist, year=album.release_year,
        release_type=album.release_type, created_at=album.created_at,
        tracks=[TrackResponse(id=track.id, position=track.position, title=track.title) for track in album.tracks],
        latest_revision=LatestRevisionResponse(
            id=latest_revision.id, created_at=latest_revision.created_at,
            pre_rating=latest_revision.pre_rating, final_rating=latest_revision.final_rating,
        ) if latest_revision else None,
    )


def revision_response(revision: RatingRevision) -> RatingRevisionResponse:
    return RatingRevisionResponse(
        id=revision.id, album_id=revision.album_id, created_at=revision.created_at,
        coherence=revision.coherence, coherence_notes=revision.coherence_notes,
        emotion=revision.emotion, emotion_notes=revision.emotion_notes, album_notes=revision.album_notes,
        pre_rating=revision.pre_rating, bad_experience=revision.bad_experience, final_rating=revision.final_rating,
        tracks=[
            TrackRatingRevisionResponse(
                track_id=track.track_id, title=track.track_title, position=track.track_position,
                score=track.score, include_in_pre_rating=track.include_in_pre_rating, notes=track.notes,
            )
            for track in revision.track_ratings
        ],
    )


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/albums", response_model=AlbumResponse, status_code=status.HTTP_201_CREATED, tags=["albums"])
def create_album(payload: AlbumCreate, session: Session = Depends(get_session)) -> AlbumResponse:
    album = Album(
        title=payload.title, artist=payload.artist, release_year=payload.year, release_type=payload.release_type,
        tracks=[Track(position=track.position, title=track.title) for track in payload.tracks],
    )
    try:
        session.add(album)
        session.commit()
        session.refresh(album)
    except Exception:
        session.rollback()
        raise
    album.tracks.sort(key=lambda track: track.position)
    return album_response(album)


@app.get("/api/albums", response_model=list[AlbumResponse], tags=["albums"])
def list_albums(session: Session = Depends(get_session)) -> list[AlbumResponse]:
    latest_revision_id = (
        select(RatingRevision.id)
        .where(RatingRevision.album_id == Album.id)
        .order_by(RatingRevision.created_at.desc(), RatingRevision.id.desc())
        .limit(1)
        .correlate(Album)
        .scalar_subquery()
    )
    rows = session.execute(
        select(Album, RatingRevision)
        .outerjoin(RatingRevision, RatingRevision.id == latest_revision_id)
        .options(selectinload(Album.tracks))
        .order_by(Album.id)
    ).all()
    for album, _ in rows:
        album.tracks.sort(key=lambda track: track.position)
    return [album_response(album, latest_revision) for album, latest_revision in rows]


@app.get("/api/albums/{album_id}", response_model=AlbumResponse, tags=["albums"])
def get_album(album_id: int, session: Session = Depends(get_session)) -> AlbumResponse:
    album = session.scalar(select(Album).options(selectinload(Album.tracks)).where(Album.id == album_id))
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="album not found")
    album.tracks.sort(key=lambda track: track.position)
    return album_response(album)


@app.post("/api/albums/{album_id}/revisions", response_model=RatingRevisionResponse,
          status_code=status.HTTP_201_CREATED, tags=["revisions"])
def create_revision(album_id: int, payload: RatingRevisionCreate,
                    session: Session = Depends(get_session)) -> RatingRevisionResponse:
    album = session.scalar(select(Album).options(selectinload(Album.tracks)).where(Album.id == album_id))
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="album not found")
    try:
        revision = create_rating_revision(session, album, payload)
        session.commit()
        session.refresh(revision, attribute_names=["track_ratings"])
    except RevisionTracksError as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error
    except Exception:
        session.rollback()
        raise
    revision.track_ratings.sort(key=lambda track: track.track_position)
    return revision_response(revision)


@app.get("/api/albums/{album_id}/revisions", response_model=list[RatingRevisionSummaryResponse], tags=["revisions"])
def list_revisions(album_id: int, session: Session = Depends(get_session)) -> list[RatingRevisionSummaryResponse]:
    if session.scalar(select(Album.id).where(Album.id == album_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="album not found")
    revisions = session.scalars(
        select(RatingRevision).where(RatingRevision.album_id == album_id).order_by(RatingRevision.created_at, RatingRevision.id)
    ).all()
    return [
        RatingRevisionSummaryResponse(
            id=revision.id, created_at=revision.created_at, pre_rating=revision.pre_rating,
            coherence=revision.coherence, emotion=revision.emotion, bad_experience=revision.bad_experience,
            final_rating=revision.final_rating,
        )
        for revision in revisions
    ]


@app.get("/api/albums/{album_id}/revisions/{revision_id}", response_model=RatingRevisionResponse, tags=["revisions"])
def get_revision(album_id: int, revision_id: int, session: Session = Depends(get_session)) -> RatingRevisionResponse:
    revision = session.scalar(
        select(RatingRevision).options(selectinload(RatingRevision.track_ratings)).where(
            RatingRevision.id == revision_id, RatingRevision.album_id == album_id
        )
    )
    if revision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="revision not found")
    revision.track_ratings.sort(key=lambda track: track.track_position)
    return revision_response(revision)
