from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timezone
import json
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.config import cover_dir, web_origins
from app.models.music import Album, AlbumArtist, Artist, LegacyRating, RatingRevision, Track, TrackArtist, TrackArtistRole, TrackRatingRevision
from app.imports.legacy_excel import commit_rows, preview_workbook
from app.services.legacy_reconciliation import ReconciliationError, preview_legacy_reconciliation, reconcile_legacy_rating
from app.schemas.music import (
    AlbumCreate,
    AlbumFacetsResponse,
    AlbumRatingSummaryResponse,
    AlbumUpdate,
    CoverFromUrl,
    AlbumResponse,
    ArtistCreate,
    ArtistAlbumResponse,
    ArtistDetailResponse,
    ArtistResponse,
    TrackAppearanceResponse,
    TrackCreditsUpdate, TrackUpdate,
    LegacyImportCommitResponse,
    LegacyImportPreviewResponse,
    LegacyImportPreviewRowResponse,
    LegacyRatingSummaryResponse,
    LegacyReconciliationRequest,
    LegacyReconciliationPreviewResponse,
    LegacyReconciliationResponse,
    LegacyRatingDetailResponse,
    LatestRevisionResponse,
    PaginatedResponse,
    RatingRevisionCreate,
    RatingRevisionResponse,
    RatingRevisionSummaryResponse,
    RevisitUpdate,
    TrackRatingRevisionResponse,
    TrackResponse,
)
from app.services.rating_revisions import RevisionTracksError, create_rating_revision
from app.services.covers import CoverError, download_cover_from_url, remove_cover_file, save_cover
from app.services.artists import artist_ids_from_inputs, get_or_create_artist, normalize_artist_name, set_album_artists, set_track_artists
from decimal import Decimal

app = FastAPI(title="Aftertone API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=web_origins(),
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
    credits = sorted(album.artist_credits, key=lambda credit: credit.position)
    artists = [ArtistResponse(id=credit.artist.id, name=credit.artist.name) for credit in credits]
    def track_response(track: Track) -> TrackResponse:
        track_credits = sorted(track.artist_credits, key=lambda credit: (credit.role.value, credit.position))
        explicit_primary = [ArtistResponse(id=credit.artist.id, name=credit.artist.name) for credit in track_credits if credit.role == TrackArtistRole.PRIMARY]
        primary = explicit_primary or artists
        featured = [ArtistResponse(id=credit.artist.id, name=credit.artist.name) for credit in track_credits if credit.role == TrackArtistRole.FEATURED]
        return TrackResponse(id=track.id, disc_number=track.disc_number, position=track.position, title=track.title, primary_artists=primary, featured_artists=featured, uses_album_artists=not explicit_primary)
    return AlbumResponse(
        id=album.id, title=album.title, artists=artists, year=album.release_year,
        release_type=album.release_type, disc_count=album.disc_count, created_at=album.created_at,
        tracks=[track_response(track) for track in sorted(album.tracks, key=lambda track: (track.disc_number, track.position))],
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


def effective_album_rating(album: Album) -> Decimal | None:
    """Return the rating currently shown for an album outside its detail history."""
    latest_revision = max(album.revisions, key=lambda revision: (revision.created_at, revision.id), default=None)
    if latest_revision is not None:
        return latest_revision.final_rating
    latest_legacy = max(album.legacy_ratings, key=lambda legacy: (legacy.imported_at, legacy.id), default=None)
    if latest_legacy is None:
        return None
    return latest_legacy.computed_final_rating if latest_legacy.computed_final_rating is not None else latest_legacy.legacy_final_rating


def revision_response(revision: RatingRevision) -> RatingRevisionResponse:
    return RatingRevisionResponse(
        id=revision.id, album_id=revision.album_id, created_at=revision.created_at,
        coherence=revision.coherence, coherence_notes=revision.coherence_notes,
        emotion=revision.emotion, emotion_notes=revision.emotion_notes, album_notes=revision.album_notes,
        pre_rating=revision.pre_rating, bad_experience=revision.bad_experience, final_rating=revision.final_rating,
        tracks=[
            TrackRatingRevisionResponse(
                track_id=track.track_id, title=track.track_title, disc_number=track.disc_number, position=track.track_position,
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
        title=payload.title, release_year=payload.year, release_type=payload.release_type, disc_count=payload.disc_count,
        tracks=[Track(disc_number=track.disc_number, position=track.position, title=track.title) for track in payload.tracks],
    )
    try:
        session.add(album)
        session.flush()
        set_album_artists(session, album, artist_ids_from_inputs(session, payload.artists))
        session.commit()
        session.refresh(album)
    except Exception:
        session.rollback()
        raise
    album.tracks.sort(key=lambda track: (track.disc_number, track.position))
    return album_response(album)


def album_filters(year: int | None, decade: int | None, search: str | None):
    filters = []
    if year is not None:
        filters.append(Album.release_year == year)
    if decade is not None:
        filters.extend([Album.release_year >= decade, Album.release_year <= decade + 9])
    if search and (term := search.strip()):
        pattern = f"%{term.casefold()}%"
        artist_match = select(AlbumArtist.id).join(Artist).where(
            AlbumArtist.album_id == Album.id,
            func.lower(Artist.name).like(pattern),
        ).exists()
        filters.append(or_(func.lower(Album.title).like(pattern), artist_match))
    return filters


def latest_rating_ids():
    latest_revision_id = (
        select(RatingRevision.id).where(RatingRevision.album_id == Album.id)
        .order_by(RatingRevision.created_at.desc(), RatingRevision.id.desc()).limit(1).correlate(Album).scalar_subquery()
    )
    latest_legacy_id = (
        select(LegacyRating.id).where(LegacyRating.album_id == Album.id)
        .order_by(LegacyRating.imported_at.desc(), LegacyRating.id.desc()).limit(1).correlate(Album).scalar_subquery()
    )
    return latest_revision_id, latest_legacy_id


def effective_rating_value():
    """Match the rating precedence exposed by the Library response."""
    return case(
        (RatingRevision.id.is_not(None), RatingRevision.final_rating),
        else_=func.coalesce(LegacyRating.computed_final_rating, LegacyRating.legacy_final_rating),
    )


@app.get("/api/albums", response_model=PaginatedResponse[AlbumResponse], tags=["albums"])
def list_albums(
    page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    year: Annotated[int | None, Query(ge=1000, le=3000)] = None, decade: Annotated[int | None, Query(ge=1000, le=3000)] = None,
    search: str | None = None, sort: Annotated[str, Query(pattern="^(rating|recent|year|artist|title)$")] = "rating",
    session: Session = Depends(get_session),
) -> PaginatedResponse[AlbumResponse]:
    latest_revision_id, latest_legacy_id = latest_rating_ids()
    filters = album_filters(year, decade, search)
    total = session.scalar(select(func.count(Album.id)).where(*filters)) or 0
    rating_value = effective_rating_value()
    recent_value = func.coalesce(RatingRevision.created_at, LegacyRating.imported_at)
    first_artist_name = select(Artist.name).join(AlbumArtist).where(AlbumArtist.album_id == Album.id).order_by(AlbumArtist.position).limit(1).scalar_subquery()
    ordering = {
        "rating": (rating_value.desc().nullslast(), Album.title.asc(), Album.id.asc()),
        "recent": (recent_value.desc().nullslast(), Album.title.asc(), Album.id.asc()),
        "year": (Album.release_year.desc().nullslast(), Album.title.asc(), Album.id.asc()),
        "artist": (func.lower(first_artist_name).asc(), Album.title.asc(), Album.id.asc()),
        "title": (func.lower(Album.title).asc(), Album.id.asc()),
    }[sort]
    rows = session.execute(
        select(Album, RatingRevision, LegacyRating)
        .outerjoin(RatingRevision, RatingRevision.id == latest_revision_id)
        .outerjoin(LegacyRating, LegacyRating.id == latest_legacy_id)
        .where(*filters)
        .options(
            selectinload(Album.tracks).selectinload(Track.artist_credits).selectinload(TrackArtist.artist),
            selectinload(Album.artist_credits).selectinload(AlbumArtist.artist),
        )
        .order_by(*ordering)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    for album, _, _ in rows:
        album.tracks.sort(key=lambda track: (track.disc_number, track.position))
    return PaginatedResponse(
        items=[album_response(album, latest_revision, latest_legacy) for album, latest_revision, latest_legacy in rows],
        page=page, page_size=page_size, total=total, total_pages=(total + page_size - 1) // page_size,
    )


@app.get("/api/albums/summary", response_model=AlbumRatingSummaryResponse, tags=["albums"])
def album_rating_summary(
    year: Annotated[int | None, Query(ge=1000, le=3000)] = None,
    decade: Annotated[int | None, Query(ge=1000, le=3000)] = None,
    session: Session = Depends(get_session),
) -> AlbumRatingSummaryResponse:
    latest_revision_id, latest_legacy_id = latest_rating_ids()
    effective_rating = effective_rating_value()
    average, rated_count = session.execute(
        select(func.avg(effective_rating), func.count(effective_rating))
        .select_from(Album)
        .outerjoin(RatingRevision, RatingRevision.id == latest_revision_id)
        .outerjoin(LegacyRating, LegacyRating.id == latest_legacy_id)
        .where(*album_filters(year, decade, None))
    ).one()
    return AlbumRatingSummaryResponse(average=average, rated_count=rated_count)


@app.get("/api/albums/facets", response_model=AlbumFacetsResponse, tags=["albums"])
def album_facets(session: Session = Depends(get_session)) -> AlbumFacetsResponse:
    years = session.scalars(select(Album.release_year).where(Album.release_year.is_not(None)).distinct().order_by(Album.release_year)).all()
    decades: dict[int, list[int]] = {}
    for year in years:
        assert year is not None
        decades.setdefault(year // 10 * 10, []).append(year)
    return AlbumFacetsResponse(decades=decades)


@app.get("/api/albums/{album_id}", response_model=AlbumResponse, tags=["albums"])
def get_album(album_id: int, session: Session = Depends(get_session)) -> AlbumResponse:
    album = session.scalar(select(Album).options(
        selectinload(Album.tracks).selectinload(Track.artist_credits).selectinload(TrackArtist.artist),
        selectinload(Album.artist_credits).selectinload(AlbumArtist.artist),
    ).where(Album.id == album_id))
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="album not found")
    album.tracks.sort(key=lambda track: (track.disc_number, track.position))
    latest_legacy = session.scalar(select(LegacyRating).where(LegacyRating.album_id == album.id).order_by(LegacyRating.imported_at.desc(), LegacyRating.id.desc()))
    return album_response(album, latest_legacy=latest_legacy)


@app.patch("/api/albums/{album_id}", response_model=AlbumResponse, tags=["albums"])
def update_album(album_id: int, payload: AlbumUpdate, session: Session = Depends(get_session)) -> AlbumResponse:
    album = album_with_tracks(album_id, session)
    album.title = payload.title
    album.release_year = payload.year
    album.release_type = payload.release_type
    try:
        set_album_artists(session, album, artist_ids_from_inputs(session, payload.artists))
        if payload.disc_count < album.disc_count and payload.tracks is None and any(track.disc_number > payload.disc_count for track in album.tracks):
            raise HTTPException(status_code=422, detail="Cannot reduce disc count while later discs contain tracks. Move or delete those tracks first.")
        if payload.tracks is not None:
            update_album_tracks(session, album, payload.tracks, payload.disc_count)
        album.disc_count = payload.disc_count
        session.commit()
        session.refresh(album)
    except Exception:
        session.rollback()
        raise
    return album_response(album)


def update_album_tracks(session: Session, album: Album, tracks: list[TrackUpdate], disc_count: int) -> None:
    current = {track.id: track for track in album.tracks}
    incoming_ids = [track.id for track in tracks if track.id is not None]
    if len(incoming_ids) != len(set(incoming_ids)) or any(track_id not in current for track_id in incoming_ids):
        raise HTTPException(status_code=422, detail="Tracklist contains invalid track ids.")

    removed = set(current) - set(incoming_ids)
    if removed and session.scalar(select(TrackRatingRevision.id).where(TrackRatingRevision.track_id.in_(removed)).limit(1)) is not None:
        raise HTTPException(status_code=422, detail="Tracks used by native rating revisions cannot be deleted.")

    if any(track.disc_number > disc_count for track in tracks):
        raise HTTPException(status_code=422, detail="A track disc number exceeds the album disc count.")

    offset = max((track.position for track in current.values()), default=0) + len(tracks) + 1
    for track in current.values():
        track.position += offset
    session.flush()
    positions_by_disc: dict[int, int] = {}
    for item in tracks:
        position = positions_by_disc.get(item.disc_number, 0) + 1
        positions_by_disc[item.disc_number] = position
        track = current[item.id] if item.id is not None else Track(album=album, disc_number=item.disc_number, position=position, title=item.title)
        track.disc_number = item.disc_number
        track.position = position
        track.title = item.title
        if item.id is None:
            session.add(track)
    for track_id in removed:
        session.delete(current[track_id])


@app.get("/api/artists", response_model=PaginatedResponse[ArtistResponse], tags=["artists"])
def list_artists(
    page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=100)] = 50, search: str | None = None,
    session: Session = Depends(get_session),
) -> PaginatedResponse[ArtistResponse]:
    filters = [func.lower(Artist.name).like(f"%{search.strip().casefold()}%")] if search and search.strip() else []
    total = session.scalar(select(func.count(Artist.id)).where(*filters)) or 0
    album_count = select(func.count(AlbumArtist.id)).where(AlbumArtist.artist_id == Artist.id).correlate(Artist).scalar_subquery()
    rows = session.execute(select(Artist, album_count.label("album_count")).where(*filters).order_by(func.lower(Artist.name), Artist.id).offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedResponse(
        items=[ArtistResponse(id=artist.id, name=artist.name, album_count=count) for artist, count in rows],
        page=page, page_size=page_size, total=total, total_pages=(total + page_size - 1) // page_size,
    )


@app.post("/api/artists", response_model=ArtistResponse, status_code=status.HTTP_201_CREATED, tags=["artists"])
def create_artist(payload: ArtistCreate, session: Session = Depends(get_session)) -> ArtistResponse:
    artist = get_or_create_artist(session, payload.name)
    session.commit()
    return ArtistResponse(id=artist.id, name=artist.name, album_count=0)


@app.get("/api/artists/{artist_id}", response_model=ArtistDetailResponse, tags=["artists"])
def get_artist(artist_id: int, session: Session = Depends(get_session)) -> ArtistDetailResponse:
    artist = session.scalar(select(Artist).options(
        selectinload(Artist.album_credits).selectinload(AlbumArtist.album).selectinload(Album.artist_credits).selectinload(AlbumArtist.artist),
        selectinload(Artist.album_credits).selectinload(AlbumArtist.album).selectinload(Album.revisions),
        selectinload(Artist.album_credits).selectinload(AlbumArtist.album).selectinload(Album.legacy_ratings),
        selectinload(Artist.track_credits).selectinload(TrackArtist.track).selectinload(Track.album),
    ).where(Artist.id == artist_id))
    if artist is None:
        raise HTTPException(status_code=404, detail="artist not found")
    albums = sorted((credit.album for credit in artist.album_credits), key=lambda album: album.id)
    return ArtistDetailResponse(
        id=artist.id, name=artist.name, album_count=len(albums),
        albums=[ArtistAlbumResponse(
            id=album.id, title=album.title, year=album.release_year, release_type=album.release_type,
            cover_url=f"/media/covers/{album.cover_filename}" if album.cover_filename else None,
            artists=[ArtistResponse(id=credit.artist.id, name=credit.artist.name) for credit in sorted(album.artist_credits, key=lambda credit: credit.position)],
            rating=effective_album_rating(album),
        ) for album in albums],
        featured_appearances=[TrackAppearanceResponse(
            track_id=credit.track.id, track_title=credit.track.title, album_id=credit.track.album.id,
            album_title=credit.track.album.title, role=credit.role.value,
        ) for credit in sorted(artist.track_credits, key=lambda credit: (credit.track.album_id, credit.track.disc_number, credit.track.position)) if credit.role == TrackArtistRole.FEATURED],
    )


@app.patch("/api/tracks/{track_id}/artists", response_model=TrackResponse, tags=["tracks"])
def update_track_artists(track_id: int, payload: TrackCreditsUpdate, session: Session = Depends(get_session)) -> TrackResponse:
    track = session.get(Track, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="track not found")
    try:
        set_track_artists(session, track, payload.primary_artist_ids, payload.featured_artist_ids)
        session.commit()
        session.refresh(track)
    except ValueError as error:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error
    album = session.get(Album, track.album_id)
    assert album is not None
    return album_response(album).tracks[[item.id for item in album.tracks].index(track.id)]


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
    album = session.scalar(select(Album).options(
        selectinload(Album.tracks).selectinload(Track.artist_credits).selectinload(TrackArtist.artist),
        selectinload(Album.artist_credits).selectinload(AlbumArtist.artist),
    ).where(Album.id == album_id))
    if album is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="album not found")
    album.tracks.sort(key=lambda track: (track.disc_number, track.position))
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
    revision.track_ratings.sort(key=lambda track: (track.disc_number, track.track_position))
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
    revision.track_ratings.sort(key=lambda track: (track.disc_number, track.track_position))
    return revision_response(revision)
