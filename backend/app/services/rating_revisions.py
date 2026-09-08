from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.music import Album, RatingRevision, Track, TrackRatingRevision
from app.ratings.calculator import TrackScore, calculate_rating
from app.schemas.music import RatingRevisionCreate


class RevisionTracksError(ValueError):
    """The submitted snapshot does not exactly match an album's track list."""


def create_rating_revision(session: Session, album: Album, payload: RatingRevisionCreate) -> RatingRevision:
    """Build and flush a complete immutable revision inside the caller's transaction."""
    submitted_ids = [item.track_id for item in payload.tracks]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise RevisionTracksError("each track may appear only once in a revision")

    album_tracks = {track.id: track for track in album.tracks}
    submitted_set = set(submitted_ids)
    album_track_ids = set(album_tracks)
    unknown_or_foreign = submitted_set - album_track_ids
    if unknown_or_foreign:
        known_ids = set(session.scalars(select(Track.id).where(Track.id.in_(unknown_or_foreign))))
        foreign_ids = unknown_or_foreign & known_ids
        if foreign_ids:
            raise RevisionTracksError("a submitted track belongs to another album")
        raise RevisionTracksError("a submitted track does not exist")
    if submitted_set != album_track_ids:
        raise RevisionTracksError("a complete revision must include every album track")

    result = calculate_rating(
        [TrackScore(item.score, item.include_in_pre_rating) for item in payload.tracks],
        coherence=payload.coherence,
        emotion=payload.emotion,
    )
    revision = RatingRevision(
        album_id=album.id,
        coherence=payload.coherence,
        coherence_notes=payload.coherence_notes,
        emotion=payload.emotion,
        emotion_notes=payload.emotion_notes,
        album_notes=payload.album_notes,
        pre_rating=result.pre_rating,
        bad_experience=result.bad_experience,
        final_rating=result.final_rating,
    )
    for item in payload.tracks:
        track = album_tracks[item.track_id]
        revision.track_ratings.append(
            TrackRatingRevision(
                track_id=track.id,
                track_title=track.title,
                disc_number=track.disc_number,
                track_position=track.position,
                score=item.score,
                notes=item.notes,
                include_in_pre_rating=item.include_in_pre_rating,
            )
        )
    session.add(revision)
    session.flush()
    return revision
