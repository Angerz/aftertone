from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timedelta, timezone
import json
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.config import cover_dir, web_origins
from app.models.music import Album, AlbumArtist, Artist, ArtistType, FavoriteSongEntry, LegacyRating, RatingRevision, ReleaseType, Track, TrackArtist, TrackArtistRole, TrackRatingRevision
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
    ArtistCreditInput,
    ArtistUpdate,
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
    MusicBrainzImportRequest,
    MusicBrainzReleasePreview,
    MusicBrainzSearchResult,
    LatestRevisionResponse,
    PaginatedResponse,
    RatingRevisionCreate,
    RatingRevisionResponse,
    RatingRevisionSummaryResponse,
    RevisitUpdate,
    TrackRatingRevisionResponse,
    TrackResponse,
    FavoriteSongEntryWrite, FavoriteSongEntryUpdate, FavoriteSongEntryResponse, FavoriteSongTrackSearchResponse,
)
from app.favorite_songs.calculator import calculate_favorite_song_score
from app.services.rating_revisions import RevisionTracksError, create_rating_revision
from app.services.covers import CoverError, download_cover_from_url, remove_cover_file, save_cover
from app.services.artists import artist_ids_from_inputs, get_or_create_artist, normalize_artist_name, set_album_artists, set_track_artists
from app.integrations.musicbrainz import MusicBrainzError, release_preview, search_releases
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
    artists = [ArtistResponse(id=credit.artist.id, name=credit.artist.name, is_active=credit.artist.is_active) for credit in credits]
    def track_response(track: Track) -> TrackResponse:
        track_credits = sorted(track.artist_credits, key=lambda credit: (credit.role.value, credit.position))
        explicit_primary = [ArtistResponse(id=credit.artist.id, name=credit.artist.name, is_active=credit.artist.is_active) for credit in track_credits if credit.role == TrackArtistRole.PRIMARY]
        primary = explicit_primary or artists
        featured = [ArtistResponse(id=credit.artist.id, name=credit.artist.name, is_active=credit.artist.is_active) for credit in track_credits if credit.role == TrackArtistRole.FEATURED]
        return TrackResponse(id=track.id, disc_number=track.disc_number, position=track.position, title=track.title, primary_artists=primary, featured_artists=featured, uses_album_artists=not explicit_primary)
    return AlbumResponse(
        id=album.id, title=album.title, musicbrainz_release_id=album.musicbrainz_release_id, artists=artists, year=album.release_year,
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


@app.get("/api/metadata/musicbrainz/releases/search", response_model=list[MusicBrainzSearchResult], tags=["metadata"])
def search_musicbrainz_releases(query: Annotated[str, Query(min_length=1, max_length=300)], artist: str | None = None) -> list[MusicBrainzSearchResult]:
    try:
        return [MusicBrainzSearchResult.model_validate(item) for item in search_releases(query, artist)]
    except MusicBrainzError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@app.get("/api/metadata/musicbrainz/releases/{release_id}", response_model=MusicBrainzReleasePreview, tags=["metadata"])
def get_musicbrainz_release(release_id: str) -> MusicBrainzReleasePreview:
    try:
        return MusicBrainzReleasePreview.model_validate(release_preview(release_id))
    except MusicBrainzError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@app.post("/api/metadata/musicbrainz/releases/import", response_model=AlbumResponse, status_code=status.HTTP_201_CREATED, tags=["metadata"])
def import_musicbrainz_release(payload: MusicBrainzImportRequest, session: Session = Depends(get_session)) -> AlbumResponse:
    if session.scalar(select(Album.id).where(Album.musicbrainz_release_id == payload.musicbrainz_release_id)) is not None:
        raise HTTPException(status_code=409, detail="This MusicBrainz release has already been imported.")
    tracks = [Track(disc_number=track.disc_number, position=track.position, title=track.title) for track in payload.tracks]
    if len({(track.disc_number, track.position) for track in tracks}) != len(tracks):
        raise HTTPException(status_code=422, detail="MusicBrainz tracks must have unique positions within each disc.")
    if any(track.disc_number > payload.disc_count for track in tracks):
        raise HTTPException(status_code=422, detail="MusicBrainz track disc exceeds the album disc count.")
    album = Album(title=payload.title, musicbrainz_release_id=payload.musicbrainz_release_id, release_year=payload.year, release_type=payload.release_type, disc_count=payload.disc_count, tracks=tracks)
    cover_filename = None
    try:
        session.add(album)
        session.flush()
        album_artist_ids = artist_ids_from_inputs(session, payload.artists)
        set_album_artists(session, album, album_artist_ids)
        for track, imported_track in zip(album.tracks, payload.tracks, strict=True):
            if imported_track.primary_artists:
                primary_ids = artist_ids_from_inputs(session, [ArtistCreditInput(name=name) for name in imported_track.primary_artists])
                if primary_ids != album_artist_ids:
                    set_track_artists(session, track, primary_ids, [])
        if payload.cover_url:
            try:
                cover_filename = download_cover_from_url(payload.cover_url)
                album.cover_filename = cover_filename
            except CoverError:
                pass
        session.commit()
        session.refresh(album)
    except Exception:
        session.rollback()
        remove_cover_file(cover_filename)
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
    search: str | None = None, revisit: bool = False, unrated: bool = False, sort: Annotated[str, Query(pattern="^(rating|recent|year|artist|title)$")] = "rating",
    session: Session = Depends(get_session),
) -> PaginatedResponse[AlbumResponse]:
    latest_revision_id, latest_legacy_id = latest_rating_ids()
    filters = album_filters(year, decade, search)
    rating_value = effective_rating_value()
    if revisit:
        filters.append(Album.needs_revisit.is_(True))
    if unrated:
        filters.append(rating_value.is_(None))
    total = session.scalar(
        select(func.count(Album.id))
        .outerjoin(RatingRevision, RatingRevision.id == latest_revision_id)
        .outerjoin(LegacyRating, LegacyRating.id == latest_legacy_id)
        .where(*filters)
    ) or 0
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
    revisit: bool = False,
    unrated: bool = False,
    session: Session = Depends(get_session),
) -> AlbumRatingSummaryResponse:
    latest_revision_id, latest_legacy_id = latest_rating_ids()
    effective_rating = effective_rating_value()
    filters = album_filters(year, decade, None)
    if revisit:
        filters.append(Album.needs_revisit.is_(True))
    if unrated:
        filters.append(effective_rating.is_(None))
    average, rated_count = session.execute(
        select(func.avg(effective_rating), func.count(effective_rating))
        .select_from(Album)
        .outerjoin(RatingRevision, RatingRevision.id == latest_revision_id)
        .outerjoin(LegacyRating, LegacyRating.id == latest_legacy_id)
        .where(*filters)
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
    if payload.musicbrainz_release_id and payload.musicbrainz_release_id != album.musicbrainz_release_id:
        existing_id = session.scalar(select(Album.id).where(Album.musicbrainz_release_id == payload.musicbrainz_release_id))
        if existing_id is not None:
            raise HTTPException(status_code=409, detail="This MusicBrainz release is already linked to another album.")
    album.title = payload.title
    album.release_year = payload.year
    album.release_type = payload.release_type
    if payload.musicbrainz_release_id:
        album.musicbrainz_release_id = payload.musicbrainz_release_id
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


def artist_usage_counts():
    album_count = select(func.count(AlbumArtist.id)).where(AlbumArtist.artist_id == Artist.id).correlate(Artist).scalar_subquery()
    primary_track_count = select(func.count(TrackArtist.id)).where(
        TrackArtist.artist_id == Artist.id, TrackArtist.role == TrackArtistRole.PRIMARY,
    ).correlate(Artist).scalar_subquery()
    featured_track_count = select(func.count(TrackArtist.id)).where(
        TrackArtist.artist_id == Artist.id, TrackArtist.role == TrackArtistRole.FEATURED,
    ).correlate(Artist).scalar_subquery()
    return album_count, primary_track_count, featured_track_count


def artist_response(artist: Artist, album_count: int = 0, primary_track_count: int = 0, featured_track_count: int = 0, project_counts: dict[ReleaseType, int] | None = None, average_rating: Decimal | None = None, rated_project_count: int = 0) -> ArtistResponse:
    return ArtistResponse(
        id=artist.id, name=artist.name, normalized_name=artist.normalized_name, is_active=artist.is_active,
        artist_type=artist.artist_type, country_code=artist.country_code, birth_date=artist.birth_date,
        death_date=artist.death_date, formed_year=artist.formed_year, dissolved_year=artist.dissolved_year,
        image_url=f"/media/covers/{artist.image_filename}" if artist.image_filename else None,
        album_count=album_count, primary_track_count=primary_track_count, featured_track_count=featured_track_count,
        is_unused=not (album_count or primary_track_count or featured_track_count),
        project_counts=project_counts or {}, average_rating=average_rating, rated_project_count=rated_project_count,
    )


def artist_project_summaries():
    project_counts = {
        release_type: select(func.count(AlbumArtist.id)).join(Album).where(
            AlbumArtist.artist_id == Artist.id, Album.release_type == release_type,
        ).correlate(Artist).scalar_subquery()
        for release_type in ReleaseType
    }
    latest_revision_id, latest_legacy_id = latest_rating_ids()
    native_rating = select(RatingRevision.final_rating).where(RatingRevision.id == latest_revision_id).scalar_subquery()
    legacy_rating = select(func.coalesce(LegacyRating.computed_final_rating, LegacyRating.legacy_final_rating)).where(LegacyRating.id == latest_legacy_id).scalar_subquery()
    effective_rating = case((latest_revision_id.is_not(None), native_rating), else_=legacy_rating)
    average_rating = select(func.avg(effective_rating)).select_from(AlbumArtist).join(Album).where(
        AlbumArtist.artist_id == Artist.id,
    ).correlate(Artist).scalar_subquery()
    rated_project_count = select(func.count(effective_rating)).select_from(AlbumArtist).join(Album).where(
        AlbumArtist.artist_id == Artist.id,
    ).correlate(Artist).scalar_subquery()
    return project_counts, average_rating, rated_project_count


@app.get("/api/artists", response_model=PaginatedResponse[ArtistResponse], tags=["artists"])
def list_artists(
    page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=100)] = 50, search: str | None = None,
    active: bool | None = None, unused: bool = False, scope: Literal["all", "primary", "featuring"] = "all", sort: Literal["name", "rating", "projects"] = "name", session: Session = Depends(get_session),
) -> PaginatedResponse[ArtistResponse]:
    album_count, primary_track_count, featured_track_count = artist_usage_counts()
    project_counts, average_rating, rated_project_count = artist_project_summaries()
    filters = [func.lower(Artist.name).like(f"%{search.strip().casefold()}%")] if search and search.strip() else []
    if active is not None:
        filters.append(Artist.is_active == active)
    if unused:
        filters.extend([album_count == 0, primary_track_count == 0, featured_track_count == 0])
    if scope == "primary":
        filters.append(album_count > 0)
    elif scope == "featuring":
        filters.extend([album_count == 0, featured_track_count > 0])
    total = session.scalar(select(func.count(Artist.id)).where(*filters)) or 0
    name_order = (func.lower(Artist.name), Artist.id)
    ordering = name_order if sort == "name" else (
        (average_rating.is_(None), average_rating.desc(), *name_order) if sort == "rating" else (album_count.desc(), *name_order)
    )
    rows = session.execute(
        select(Artist, album_count, primary_track_count, featured_track_count, *project_counts.values(), average_rating, rated_project_count)
        .where(*filters).order_by(*ordering)
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return PaginatedResponse(
        items=[artist_response(
            artist, album_count, primary_count, featured_count,
            dict(zip(project_counts, counts[:len(project_counts)])), counts[-2], counts[-1],
        ) for artist, album_count, primary_count, featured_count, *counts in rows],
        page=page, page_size=page_size, total=total, total_pages=(total + page_size - 1) // page_size,
    )


@app.post("/api/artists", response_model=ArtistResponse, status_code=status.HTTP_201_CREATED, tags=["artists"])
def create_artist(payload: ArtistCreate, session: Session = Depends(get_session)) -> ArtistResponse:
    existing = session.scalar(select(Artist).where(Artist.normalized_name == normalize_artist_name(payload.name)))
    if existing is not None and not existing.is_active:
        raise HTTPException(status_code=409, detail="An inactive artist with this name already exists.")
    artist = get_or_create_artist(session, payload.name)
    session.commit()
    return artist_response(artist)


@app.patch("/api/artists/{artist_id}", response_model=ArtistResponse, tags=["artists"])
def update_artist(artist_id: int, payload: ArtistUpdate, session: Session = Depends(get_session)) -> ArtistResponse:
    artist = session.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="artist not found")
    fields = payload.model_fields_set
    next_type = payload.artist_type if "artist_type" in fields else artist.artist_type
    next_birth_date = payload.birth_date if "birth_date" in fields else artist.birth_date
    next_death_date = payload.death_date if "death_date" in fields else artist.death_date
    next_formed_year = payload.formed_year if "formed_year" in fields else artist.formed_year
    next_dissolved_year = payload.dissolved_year if "dissolved_year" in fields else artist.dissolved_year
    if next_type == ArtistType.PERSON:
        if next_formed_year is not None or next_dissolved_year is not None:
            raise HTTPException(status_code=422, detail="Group dates must be cleared for a person artist.")
        if next_birth_date and next_death_date and next_death_date < next_birth_date:
            raise HTTPException(status_code=422, detail="Death date must not be before birth date.")
    elif next_type == ArtistType.GROUP:
        if next_birth_date is not None or next_death_date is not None:
            raise HTTPException(status_code=422, detail="Person dates must be cleared for a group artist.")
        if next_formed_year and next_dissolved_year and next_dissolved_year < next_formed_year:
            raise HTTPException(status_code=422, detail="Dissolved year must not be before formed year.")
    elif any(value is not None for value in (next_birth_date, next_death_date, next_formed_year, next_dissolved_year)):
        raise HTTPException(status_code=422, detail="Type-specific dates require artist type person or group.")
    if "name" in fields:
        assert payload.name is not None
        normalized_name = normalize_artist_name(payload.name)
        duplicate = session.scalar(select(Artist).where(Artist.normalized_name == normalized_name, Artist.id != artist_id))
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="An artist with this name already exists.")
        artist.name = payload.name
        artist.normalized_name = normalized_name
    for field in ("is_active", "artist_type", "country_code", "birth_date", "death_date", "formed_year", "dissolved_year"):
        if field in fields:
            setattr(artist, field, getattr(payload, field))
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="An artist with this name already exists.") from error
    album_count, primary_track_count, featured_track_count = artist_usage_counts()
    counts = session.execute(select(album_count, primary_track_count, featured_track_count).where(Artist.id == artist_id)).one()
    return artist_response(artist, *counts)


@app.delete("/api/artists/{artist_id}", tags=["artists"])
def delete_artist(artist_id: int, session: Session = Depends(get_session)) -> dict[str, bool]:
    artist = session.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="artist not found")
    album_count, primary_track_count, featured_track_count = artist_usage_counts()
    counts = session.execute(select(album_count, primary_track_count, featured_track_count).where(Artist.id == artist_id)).one()
    if any(counts):
        raise HTTPException(status_code=409, detail="Artist cannot be deleted because it is still referenced.")
    image_filename = artist.image_filename
    try:
        session.delete(artist)
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="Artist cannot be deleted because it is still referenced.") from error
    remove_cover_file(image_filename)
    return {"deleted": True}


@app.get("/api/artists/{artist_id}", response_model=ArtistDetailResponse, tags=["artists"])
def get_artist(artist_id: int, session: Session = Depends(get_session)) -> ArtistDetailResponse:
    artist = session.scalar(select(Artist).options(
        selectinload(Artist.album_credits).selectinload(AlbumArtist.album).selectinload(Album.artist_credits).selectinload(AlbumArtist.artist),
        selectinload(Artist.album_credits).selectinload(AlbumArtist.album).selectinload(Album.revisions),
        selectinload(Artist.album_credits).selectinload(AlbumArtist.album).selectinload(Album.legacy_ratings),
        selectinload(Artist.track_credits).selectinload(TrackArtist.track).selectinload(Track.album).selectinload(Album.revisions).selectinload(RatingRevision.track_ratings),
    ).where(Artist.id == artist_id))
    if artist is None:
        raise HTTPException(status_code=404, detail="artist not found")
    albums = sorted((credit.album for credit in artist.album_credits), key=lambda album: album.id)
    return ArtistDetailResponse(
        id=artist.id, name=artist.name, is_active=artist.is_active, album_count=len(albums),
        artist_type=artist.artist_type, country_code=artist.country_code, birth_date=artist.birth_date,
        death_date=artist.death_date, formed_year=artist.formed_year, dissolved_year=artist.dissolved_year,
        image_url=f"/media/covers/{artist.image_filename}" if artist.image_filename else None,
        primary_track_count=sum(credit.role == TrackArtistRole.PRIMARY for credit in artist.track_credits),
        featured_track_count=sum(credit.role == TrackArtistRole.FEATURED for credit in artist.track_credits),
        is_unused=not artist.album_credits and not artist.track_credits,
        albums=[ArtistAlbumResponse(
            id=album.id, title=album.title, year=album.release_year, release_type=album.release_type,
            cover_url=f"/media/covers/{album.cover_filename}" if album.cover_filename else None,
            artists=[ArtistResponse(id=credit.artist.id, name=credit.artist.name, is_active=credit.artist.is_active) for credit in sorted(album.artist_credits, key=lambda credit: credit.position)],
            rating=effective_album_rating(album),
        ) for album in albums],
        featured_appearances=[TrackAppearanceResponse(
            track_id=credit.track.id, track_title=credit.track.title, track_position=credit.track.position,
            album_id=credit.track.album.id, album_title=credit.track.album.title,
            album_year=credit.track.album.release_year, album_release_type=credit.track.album.release_type,
            album_cover_url=f"/media/covers/{credit.track.album.cover_filename}" if credit.track.album.cover_filename else None,
            score=next((item.score for item in max(credit.track.album.revisions, key=lambda revision: (revision.created_at, revision.id), default=None).track_ratings if item.track_id == credit.track.id), None) if credit.track.album.revisions else None,
            role=credit.role.value,
        ) for credit in sorted(artist.track_credits, key=lambda credit: (
            credit.track.album.release_year is None, -(credit.track.album.release_year or 0), credit.track.album.title.casefold(), credit.track.disc_number, credit.track.position,
        )) if credit.role == TrackArtistRole.FEATURED],
    )


def replace_artist_image(artist: Artist, filename: str, session: Session) -> ArtistResponse:
    old_filename = artist.image_filename
    artist.image_filename = filename
    try:
        session.commit()
        session.refresh(artist)
    except Exception:
        session.rollback()
        remove_cover_file(filename)
        raise
    remove_cover_file(old_filename)
    return artist_response(artist)


@app.put("/api/artists/{artist_id}/image", response_model=ArtistResponse, tags=["artists"])
def upload_artist_image(artist_id: int, file: UploadFile = File(...), session: Session = Depends(get_session)) -> ArtistResponse:
    artist = session.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="artist not found")
    try:
        filename = save_cover(file)
    except CoverError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    finally:
        file.file.close()
    return replace_artist_image(artist, filename, session)


@app.delete("/api/artists/{artist_id}/image", response_model=ArtistResponse, tags=["artists"])
def delete_artist_image(artist_id: int, session: Session = Depends(get_session)) -> ArtistResponse:
    artist = session.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="artist not found")
    old_filename = artist.image_filename
    artist.image_filename = None
    try:
        session.commit()
        session.refresh(artist)
    except Exception:
        session.rollback()
        raise
    remove_cover_file(old_filename)
    return artist_response(artist)


@app.post("/api/artists/{artist_id}/image/from-url", response_model=ArtistResponse, tags=["artists"])
def import_artist_image_from_url(artist_id: int, payload: CoverFromUrl, session: Session = Depends(get_session)) -> ArtistResponse:
    artist = session.get(Artist, artist_id)
    if artist is None:
        raise HTTPException(status_code=404, detail="artist not found")
    try:
        filename = download_cover_from_url(payload.url)
    except CoverError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return replace_artist_image(artist, filename, session)


def favorite_song_sort_key(entry: FavoriteSongEntry) -> tuple:
    """Canonical deterministic ordering for every favorite-song position."""
    return (-entry.final_score, -entry.emotional_connection, -entry.replay_value, -entry.base_score, -entry.originality, entry.track.title.casefold())


def favorite_song_rows(session: Session) -> list[FavoriteSongEntry]:
    rows = session.scalars(select(FavoriteSongEntry).options(
        selectinload(FavoriteSongEntry.track).selectinload(Track.album).selectinload(Album.artist_credits).selectinload(AlbumArtist.artist),
        selectinload(FavoriteSongEntry.track).selectinload(Track.artist_credits).selectinload(TrackArtist.artist),
        selectinload(FavoriteSongEntry.track).selectinload(Track.album).selectinload(Album.revisions).selectinload(RatingRevision.track_ratings),
    )).all()
    return sorted(rows, key=favorite_song_sort_key)


def favorite_song_top_100_positions(session: Session) -> dict[int, int]:
    """Capture canonical Top 100 positions before a ranking-changing write."""
    return {entry.id: position for position, entry in enumerate(favorite_song_rows(session), 1) if position <= 100}


def apply_favorite_song_rank_history(rows: list[FavoriteSongEntry], previous_positions: dict[int, int], now: datetime) -> None:
    """Persist history against canonical rows, never presentation order."""
    for position, entry in enumerate(rows, 1):
        previous_position = previous_positions.get(entry.id)
        if position <= 100:
            if previous_position != position:
                entry.last_rank_from = previous_position
                entry.last_rank_to = position
                entry.last_rank_changed_at = now
            if previous_position is None or entry.top_100_entered_at is None:
                entry.top_100_entered_at = now
        else:
            entry.top_100_entered_at = None


def sync_favorite_song_rank_history(session: Session, previous_positions: dict[int, int]) -> list[FavoriteSongEntry]:
    """Persist movement relative to the meaningful ranking state before a write."""
    rows = favorite_song_rows(session)
    current_positions = {entry.id: position for position, entry in enumerate(rows, 1) if position <= 100}
    if current_positions != previous_positions:
        apply_favorite_song_rank_history(rows, previous_positions, datetime.now(timezone.utc))
    return rows


def favorite_song_movement(entry: FavoriteSongEntry, position: int, now: datetime | None = None) -> tuple[str, int]:
    changed_at = entry.last_rank_changed_at
    if position > 100 or changed_at is None:
        return "unchanged", 0
    if changed_at.tzinfo is None:
        changed_at = changed_at.replace(tzinfo=timezone.utc)
    if (now or datetime.now(timezone.utc)) - changed_at > timedelta(days=30):
        return "unchanged", 0
    if entry.last_rank_from is None:
        return "new", 0
    if entry.last_rank_to is None:
        return "unchanged", 0
    if entry.last_rank_to < entry.last_rank_from:
        return "up", entry.last_rank_from - entry.last_rank_to
    return "down", entry.last_rank_to - entry.last_rank_from


def favorite_song_artists(track: Track) -> list[ArtistResponse]:
    primary = [credit.artist for credit in sorted(track.artist_credits, key=lambda credit: credit.position) if credit.role == TrackArtistRole.PRIMARY]
    artists = primary or [credit.artist for credit in sorted(track.album.artist_credits, key=lambda credit: credit.position)]
    return [ArtistResponse(id=artist.id, name=artist.name, is_active=artist.is_active) for artist in artists]


def favorite_song_response(entry: FavoriteSongEntry, position: int) -> FavoriteSongEntryResponse:
    track, album = entry.track, entry.track.album
    movement, delta = favorite_song_movement(entry, position)
    return FavoriteSongEntryResponse(
        id=entry.id, global_position=position, track_id=track.id, track_title=track.title, artists=favorite_song_artists(track),
        album_id=album.id, album_title=album.title, album_year=album.release_year,
        cover_url=f"/media/covers/{album.cover_filename}" if album.cover_filename else None,
        disc_number=track.disc_number, track_position=track.position, base_score=entry.base_score,
        emotional_connection=entry.emotional_connection, replay_value=entry.replay_value, originality=entry.originality,
        genre=entry.genre, notes=entry.notes, final_score=entry.final_score,
        rank_movement=movement, rank_delta=delta, top_100_entered_at=entry.top_100_entered_at,
    )


def write_favorite_song(entry: FavoriteSongEntry, payload: FavoriteSongEntryWrite | FavoriteSongEntryUpdate) -> None:
    entry.base_score = payload.base_score
    entry.emotional_connection = payload.emotional_connection
    entry.replay_value = payload.replay_value
    entry.originality = payload.originality
    entry.genre = payload.genre.strip() or None if payload.genre else None
    entry.notes = payload.notes.strip() or None if payload.notes else None
    entry.final_score = calculate_favorite_song_score(
        base_score=payload.base_score, emotional_connection=payload.emotional_connection,
        replay_value=payload.replay_value, originality=payload.originality,
    )


@app.get("/api/favorite-songs", response_model=list[FavoriteSongEntryResponse], tags=["favorite songs"])
def list_favorite_songs(view: Literal["top", "candidates"] = "top", search: str | None = None, session: Session = Depends(get_session)) -> list[FavoriteSongEntryResponse]:
    rows = favorite_song_rows(session)
    needle = search.strip().casefold() if search else ""
    return [favorite_song_response(entry, position) for position, entry in enumerate(rows, 1) if (position <= 100 if view == "top" else position > 100) and (not needle or needle in entry.track.title.casefold() or needle in entry.track.album.title.casefold() or any(needle in artist.name.casefold() for artist in favorite_song_artists(entry.track)))]


@app.post("/api/favorite-songs", response_model=FavoriteSongEntryResponse, status_code=status.HTTP_201_CREATED, tags=["favorite songs"])
def create_favorite_song(payload: FavoriteSongEntryWrite, session: Session = Depends(get_session)) -> FavoriteSongEntryResponse:
    previous_positions = favorite_song_top_100_positions(session)
    track = session.get(Track, payload.track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="track not found")
    entry = FavoriteSongEntry(track_id=track.id, base_score=Decimal("0"), emotional_connection=Decimal("0"), replay_value=Decimal("0"), originality=Decimal("0"), final_score=Decimal("0"))
    write_favorite_song(entry, payload)
    session.add(entry)
    try:
        session.flush()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="Track is already in the favorite-song ranking.") from error
    rows = sync_favorite_song_rank_history(session, previous_positions)
    session.commit()
    return favorite_song_response(entry, rows.index(entry) + 1)


@app.get("/api/favorite-songs/{entry_id}", response_model=FavoriteSongEntryResponse, tags=["favorite songs"])
def get_favorite_song(entry_id: int, session: Session = Depends(get_session)) -> FavoriteSongEntryResponse:
    rows = favorite_song_rows(session)
    entry = next((item for item in rows if item.id == entry_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail="favorite song not found")
    return favorite_song_response(entry, rows.index(entry) + 1)


@app.patch("/api/favorite-songs/{entry_id}", response_model=FavoriteSongEntryResponse, tags=["favorite songs"])
def update_favorite_song(entry_id: int, payload: FavoriteSongEntryUpdate, session: Session = Depends(get_session)) -> FavoriteSongEntryResponse:
    entry = session.get(FavoriteSongEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="favorite song not found")
    previous_positions = favorite_song_top_100_positions(session)
    write_favorite_song(entry, payload)
    session.flush()
    rows = sync_favorite_song_rank_history(session, previous_positions)
    session.commit()
    return favorite_song_response(entry, rows.index(entry) + 1)


@app.delete("/api/favorite-songs/{entry_id}", tags=["favorite songs"])
def delete_favorite_song(entry_id: int, session: Session = Depends(get_session)) -> dict[str, bool]:
    entry = session.get(FavoriteSongEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="favorite song not found")
    previous_positions = favorite_song_top_100_positions(session)
    session.delete(entry)
    session.flush()
    sync_favorite_song_rank_history(session, previous_positions)
    session.commit()
    return {"deleted": True}


@app.get("/api/tracks/search", response_model=list[FavoriteSongTrackSearchResponse], tags=["favorite songs"])
def search_tracks(q: str = Query(min_length=1, max_length=300), session: Session = Depends(get_session)) -> list[FavoriteSongTrackSearchResponse]:
    ranked = favorite_song_rows(session)
    positions = {entry.track_id: position for position, entry in enumerate(ranked, 1)}
    tracks = session.scalars(select(Track).options(
        selectinload(Track.album).selectinload(Album.artist_credits).selectinload(AlbumArtist.artist),
        selectinload(Track.artist_credits).selectinload(TrackArtist.artist),
        selectinload(Track.album).selectinload(Album.revisions).selectinload(RatingRevision.track_ratings),
    )).all()
    needle = q.strip().casefold(); results = []
    for track in tracks:
        artist_names = " ".join(artist.name for artist in favorite_song_artists(track))
        if needle not in track.title.casefold() and needle not in track.album.title.casefold() and needle not in artist_names.casefold():
            continue
        latest = max(track.album.revisions, key=lambda revision: (revision.created_at, revision.id), default=None)
        score = next((rating.score for rating in latest.track_ratings if rating.track_id == track.id), None) if latest else None
        results.append(FavoriteSongTrackSearchResponse(track_id=track.id, track_title=track.title, artists=favorite_song_artists(track), album_id=track.album.id, album_title=track.album.title, album_year=track.album.release_year, cover_url=f"/media/covers/{track.album.cover_filename}" if track.album.cover_filename else None, latest_track_score=score, already_ranked_position=positions.get(track.id)))
    return results[:50]


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
