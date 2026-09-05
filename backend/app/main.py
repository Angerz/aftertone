from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timezone
import json

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.config import cover_dir, web_origin
from app.models.music import Album, LegacyRating, RatingRevision, Track
from app.imports.legacy_excel import commit_rows, preview_workbook
from app.services.legacy_reconciliation import ReconciliationError, preview_legacy_reconciliation, reconcile_legacy_rating
from app.schemas.music import (
    AlbumCreate,
    AlbumUpdate,
    CoverFromUrl,
    AlbumResponse,
    LegacyImportCommitResponse,
    LegacyImportPreviewResponse,
    LegacyImportPreviewRowResponse,
    LegacyRatingSummaryResponse,
    LegacyReconciliationRequest,
    LegacyReconciliationPreviewResponse,
    LegacyReconciliationResponse,
    LegacyRatingDetailResponse,
    LatestRevisionResponse,
    RatingRevisionCreate,
    RatingRevisionResponse,
    RatingRevisionSummaryResponse,
    RevisitUpdate,
    TrackRatingRevisionResponse,
    TrackResponse,
)
from app.services.rating_revisions import RevisionTracksError, create_rating_revision
from app.services.covers import CoverError, download_cover_from_url, remove_cover_file, save_cover
from decimal import Decimal

app = FastAPI(title="Aftertone API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[web_origin()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
cover_dir().mkdir(parents=True, exist_ok=True)
app.mount("/media/covers", StaticFiles(directory=cover_dir()), name="covers")


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def album_response(album: Album, latest_revision: RatingRevision | None = None, latest_legacy: LegacyRating | None = None) -> AlbumResponse:
    return AlbumResponse(
        id=album.id, title=album.title, artist=album.artist, year=album.release_year,
        release_type=album.release_type, created_at=album.created_at,
        tracks=[TrackResponse(id=track.id, position=track.position, title=track.title) for track in album.tracks],
        latest_revision=LatestRevisionResponse(
            id=latest_revision.id, created_at=latest_revision.created_at,
            pre_rating=latest_revision.pre_rating, final_rating=latest_revision.final_rating,
        ) if latest_revision else None,
        cover_url=f"/media/covers/{album.cover_filename}" if album.cover_filename else None,
        needs_revisit=album.needs_revisit, revisit_reason=album.revisit_reason, revisit_marked_at=album.revisit_marked_at,
        latest_legacy_rating=LegacyRatingSummaryResponse(
            id=latest_legacy.id, imported_at=latest_legacy.imported_at, legacy_final_rating=latest_legacy.legacy_final_rating,
            computed_final_rating=latest_legacy.computed_final_rating, reconciliation_status=latest_legacy.reconciliation_status,
        ) if latest_legacy else None,
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
    latest_legacy_id = (
        select(LegacyRating.id).where(LegacyRating.album_id == Album.id)
        .order_by(LegacyRating.imported_at.desc(), LegacyRating.id.desc()).limit(1).correlate(Album).scalar_subquery()
    )
    rows = session.execute(
        select(Album, RatingRevision, LegacyRating)
        .outerjoin(RatingRevision, RatingRevision.id == latest_revision_id)
        .outerjoin(LegacyRating, LegacyRating.id == latest_legacy_id)
        .options(selectinload(Album.tracks))
        .order_by(Album.id)
    ).all()
    for album, _, _ in rows:
        album.tracks.sort(key=lambda track: track.position)
    return [album_response(album, latest_revision, latest_legacy) for album, latest_revision, latest_legacy in rows]


@app.get("/api/albums/{album_id}", response_model=AlbumResponse, tags=["albums"])
def get_album(album_id: int, session: Session = Depends(get_session)) -> AlbumResponse:
    album = session.scalar(select(Album).options(selectinload(Album.tracks)).where(Album.id == album_id))
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="album not found")
    album.tracks.sort(key=lambda track: track.position)
    latest_legacy = session.scalar(select(LegacyRating).where(LegacyRating.album_id == album.id).order_by(LegacyRating.imported_at.desc(), LegacyRating.id.desc()))
    return album_response(album, latest_legacy=latest_legacy)


@app.patch("/api/albums/{album_id}", response_model=AlbumResponse, tags=["albums"])
def update_album(album_id: int, payload: AlbumUpdate, session: Session = Depends(get_session)) -> AlbumResponse:
    album = album_with_tracks(album_id, session)
    album.title = payload.title
    album.artist = payload.artist
    album.release_year = payload.year
    album.release_type = payload.release_type
    try:
        session.commit()
        session.refresh(album)
    except Exception:
        session.rollback()
        raise
    return album_response(album)


@app.patch("/api/albums/{album_id}/revisit", response_model=AlbumResponse, tags=["albums"])
def mark_for_revisit(album_id: int, payload: RevisitUpdate, session: Session = Depends(get_session)) -> AlbumResponse:
    album = album_with_tracks(album_id, session)
    album.needs_revisit = True
    album.revisit_reason = payload.reason.strip() if payload.reason else None
    album.revisit_marked_at = datetime.now(timezone.utc)
    session.commit(); session.refresh(album)
    return album_response(album)


@app.delete("/api/albums/{album_id}/revisit", response_model=AlbumResponse, tags=["albums"])
def clear_revisit_mark(album_id: int, session: Session = Depends(get_session)) -> AlbumResponse:
    album = album_with_tracks(album_id, session)
    album.needs_revisit = False; album.revisit_reason = None; album.revisit_marked_at = None
    session.commit(); session.refresh(album)
    return album_response(album)


def preview_response(rows) -> LegacyImportPreviewResponse:
    return LegacyImportPreviewResponse(rows=[LegacyImportPreviewRowResponse(
        row_number=row.row_number, title=row.title, artist=row.artist, legacy_final_rating=row.legacy_final_rating,
        legacy_pre_rating=row.legacy_pre_rating, legacy_bad_experience=row.legacy_bad_experience,
        computed_pre_rating=row.computed_pre_rating, computed_bad_experience=row.computed_bad_experience,
        computed_final_rating=row.computed_final_rating, pre_formula=row.pre_formula,
        extracted_score_count=len(row.extracted_scores), status=row.status, warnings=row.warnings, errors=row.errors,
    ) for row in rows])


@app.post("/api/imports/legacy-ratings/preview", response_model=LegacyImportPreviewResponse, tags=["imports"])
def preview_legacy_import(file: UploadFile = File(...), session: Session = Depends(get_session)) -> LegacyImportPreviewResponse:
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="Select an .xlsx workbook.")
    try:
        return preview_response(preview_workbook(file.file.read(), session))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        file.file.close()


@app.post("/api/imports/legacy-ratings/commit", response_model=LegacyImportCommitResponse, tags=["imports"])
def commit_legacy_import(file: UploadFile = File(...), selected_rows: str = Form(...), session: Session = Depends(get_session)) -> LegacyImportCommitResponse:
    try:
        selected = {int(value) for value in json.loads(selected_rows)}
        rows = preview_workbook(file.file.read(), session)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        file.file.close()
    imported, skipped, failed = commit_rows(rows, selected, session)
    return LegacyImportCommitResponse(imported=imported, skipped=skipped, failed=failed)

@app.get("/api/legacy-ratings/{legacy_rating_id}", response_model=LegacyRatingDetailResponse, tags=["legacy"])
def get_legacy_rating(legacy_rating_id: int, session: Session = Depends(get_session)) -> LegacyRatingDetailResponse:
    legacy = session.get(LegacyRating, legacy_rating_id)
    if legacy is None: raise HTTPException(status_code=404, detail="legacy rating not found")
    return LegacyRatingDetailResponse(id=legacy.id, album_id=legacy.album_id, extracted_scores=[Decimal(value) for value in legacy.extracted_scores], coherence=legacy.coherence, emotion=legacy.emotion, legacy_pre_rating=legacy.legacy_pre_rating, legacy_bad_experience=legacy.legacy_bad_experience, legacy_final_rating=legacy.legacy_final_rating, reconciliation_status=legacy.reconciliation_status)


@app.post("/api/legacy-ratings/{legacy_rating_id}/reconcile", response_model=LegacyReconciliationResponse, tags=["legacy"])
def reconcile_legacy(legacy_rating_id: int, payload: LegacyReconciliationRequest, session: Session = Depends(get_session)) -> LegacyReconciliationResponse:
    legacy = session.get(LegacyRating, legacy_rating_id)
    if legacy is None:
        raise HTTPException(status_code=404, detail="legacy rating not found")
    was_pending = legacy.reconciliation_status == "pending"
    try:
        revision = reconcile_legacy_rating(session, legacy, payload)
        session.commit()
    except ReconciliationError as error:
        session.rollback()
        raise HTTPException(status_code=422 if was_pending else 409, detail=str(error)) from error
    except Exception:
        session.rollback()
        raise
    return LegacyReconciliationResponse(revision_id=revision.id, pre_rating=revision.pre_rating, bad_experience=revision.bad_experience, final_rating=revision.final_rating)


@app.post("/api/legacy-ratings/{legacy_rating_id}/reconcile-preview", response_model=LegacyReconciliationPreviewResponse, tags=["legacy"])
def preview_legacy_reconciliation_endpoint(legacy_rating_id: int, payload: LegacyReconciliationRequest, session: Session = Depends(get_session)) -> LegacyReconciliationPreviewResponse:
    legacy = session.get(LegacyRating, legacy_rating_id)
    if legacy is None:
        raise HTTPException(status_code=404, detail="legacy rating not found")
    was_pending = legacy.reconciliation_status == "pending"
    try:
        result = preview_legacy_reconciliation(session, legacy, payload)
    except ReconciliationError as error:
        raise HTTPException(status_code=422 if was_pending else 409, detail=str(error)) from error
    return LegacyReconciliationPreviewResponse(pre_rating=result.pre_rating, bad_experience=result.bad_experience, final_rating=result.final_rating)


def album_with_tracks(album_id: int, session: Session) -> Album:
    album = session.scalar(select(Album).options(selectinload(Album.tracks)).where(Album.id == album_id))
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="album not found")
    album.tracks.sort(key=lambda track: track.position)
    return album


def replace_cover(album: Album, filename: str, session: Session) -> AlbumResponse:
    old_filename = album.cover_filename
    album.cover_filename = filename
    try:
        session.commit()
        session.refresh(album)
    except Exception:
        session.rollback()
        remove_cover_file(filename)
        raise
    remove_cover_file(old_filename)
    return album_response(album)


@app.put("/api/albums/{album_id}/cover", response_model=AlbumResponse, tags=["albums"])
def upload_cover(album_id: int, file: UploadFile = File(...), session: Session = Depends(get_session)) -> AlbumResponse:
    album = album_with_tracks(album_id, session)
    try:
        filename = save_cover(file)
    except CoverError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    finally:
        file.file.close()
    return replace_cover(album, filename, session)


@app.post("/api/albums/{album_id}/cover/from-url", response_model=AlbumResponse, tags=["albums"])
def import_cover_from_url(album_id: int, payload: CoverFromUrl, session: Session = Depends(get_session)) -> AlbumResponse:
    album = album_with_tracks(album_id, session)
    try:
        filename = download_cover_from_url(payload.url)
    except CoverError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return replace_cover(album, filename, session)


@app.delete("/api/albums/{album_id}/cover", response_model=AlbumResponse, tags=["albums"])
def delete_cover(album_id: int, session: Session = Depends(get_session)) -> AlbumResponse:
    album = album_with_tracks(album_id, session)
    old_filename = album.cover_filename
    album.cover_filename = None
    try:
        session.commit()
        session.refresh(album)
    except Exception:
        session.rollback()
        raise
    remove_cover_file(old_filename)
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
