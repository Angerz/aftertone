from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.music import Album, LegacyRating, RatingRevision, Track, TrackRatingRevision
from app.ratings.calculator import TrackScore, calculate_rating
from app.schemas.music import LegacyReconciliationRequest

class ReconciliationError(ValueError): pass

def _mapped_scores(legacy: LegacyRating, payload: LegacyReconciliationRequest, track_ids: set[int], aliases: dict[int, int] | None = None) -> dict[int, Decimal]:
    scores = [Decimal(value) for value in legacy.extracted_scores]; mappings = payload.track_mappings
    if len(mappings) != len(scores) or {item.legacy_score_index for item in mappings} != set(range(len(scores))): raise ReconciliationError("every legacy score must be mapped exactly once")
    aliases = aliases or {}
    ids = [aliases.get(item.track_id, item.track_id) for item in mappings]
    if len(ids) != len(set(ids)): raise ReconciliationError("each track may receive at most one legacy score")
    if not set(ids) <= track_ids: raise ReconciliationError("a mapped track does not belong to this album")
    return {aliases.get(item.track_id, item.track_id): scores[item.legacy_score_index] for item in mappings}


def preview_legacy_reconciliation(session: Session, legacy: LegacyRating, payload: LegacyReconciliationRequest):
    if legacy.reconciliation_status != "pending": raise ReconciliationError("legacy rating has already been reconciled")
    tracks = list(session.scalars(select(Track.id).where(Track.album_id == legacy.album_id)))
    if not tracks:
        titles = [title.strip() for title in payload.track_titles if title.strip()]
        if not titles: raise ReconciliationError("add a real tracklist before reconciling")
        tracks = list(range(1, len(titles) + 1))
    mapped = _mapped_scores(legacy, payload, set(tracks))
    return calculate_rating([TrackScore(score) for score in mapped.values()], coherence=legacy.coherence, emotion=legacy.emotion)


def reconcile_legacy_rating(session: Session, legacy: LegacyRating, payload: LegacyReconciliationRequest) -> RatingRevision:
    if legacy.reconciliation_status != "pending": raise ReconciliationError("legacy rating has already been reconciled")
    album = session.get(Album, legacy.album_id)
    if album is None: raise ReconciliationError("legacy album does not exist")
    tracks = list(session.scalars(select(Track).where(Track.album_id == album.id).order_by(Track.position)))
    temporary_track_ids: dict[int, int] = {}
    if not tracks and payload.track_titles:
        titles = [title.strip() for title in payload.track_titles if title.strip()]
        if not titles: raise ReconciliationError("tracklist must contain titles")
        tracks = [Track(album_id=album.id, position=index + 1, title=title) for index, title in enumerate(titles)]
        session.add_all(tracks); session.flush()
        temporary_track_ids = {index + 1: track.id for index, track in enumerate(tracks)}
    if not tracks: raise ReconciliationError("add a real tracklist before reconciling")
    mapped = _mapped_scores(legacy, payload, {track.id for track in tracks}, temporary_track_ids)
    result = calculate_rating([TrackScore(score) for score in mapped.values()], coherence=legacy.coherence, emotion=legacy.emotion)
    revision = RatingRevision(album_id=album.id, coherence=legacy.coherence, emotion=legacy.emotion, coherence_notes=None, emotion_notes=None, album_notes=None, pre_rating=result.pre_rating, bad_experience=result.bad_experience, final_rating=result.final_rating)
    for track in tracks:
        score = mapped.get(track.id)
        revision.track_ratings.append(TrackRatingRevision(track_id=track.id, track_title=track.title, track_position=track.position, score=score, include_in_pre_rating=score is not None, notes=None))
    session.add(revision); session.flush(); legacy.reconciliation_status = "reconciled"; legacy.reconciled_revision_id = revision.id
    return revision
