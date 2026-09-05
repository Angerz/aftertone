from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.music import Album, AlbumArtist, Artist, Track, TrackArtist, TrackArtistRole


def normalize_artist_name(name: str) -> str:
    return " ".join(name.split()).casefold()


def get_or_create_artist(session: Session, name: str) -> Artist:
    visible = " ".join(name.split())
    if not visible:
        raise ValueError("artist name must not be empty")
    normalized = normalize_artist_name(visible)
    artist = session.scalar(select(Artist).where(Artist.normalized_name == normalized))
    if artist is None:
        artist = Artist(name=visible, normalized_name=normalized)
        session.add(artist)
        session.flush()
    return artist


def set_album_artists(session: Session, album: Album, artist_ids: list[int]) -> None:
    if not artist_ids or len(artist_ids) != len(set(artist_ids)):
        raise ValueError("an album needs unique artists")
    artists = session.scalars(select(Artist).where(Artist.id.in_(artist_ids))).all()
    if len(artists) != len(artist_ids):
        raise ValueError("an album artist does not exist")
    album.artist_credits.clear()
    session.flush()
    album.artist_credits.extend(AlbumArtist(artist_id=artist_id, position=index + 1) for index, artist_id in enumerate(artist_ids))


def artist_ids_from_inputs(session: Session, inputs) -> list[int]:
    ids: list[int] = []
    for item in inputs:
        if item.artist_id is not None:
            ids.append(item.artist_id)
        elif item.name:
            ids.append(get_or_create_artist(session, item.name).id)
        else:
            raise ValueError("artist credit needs an existing artist or a name")
    return ids


def set_track_artists(session: Session, track: Track, primary_ids: list[int], featured_ids: list[int]) -> None:
    if set(primary_ids) & set(featured_ids) or len(primary_ids) != len(set(primary_ids)) or len(featured_ids) != len(set(featured_ids)):
        raise ValueError("track artist credits must be unique")
    ids = primary_ids + featured_ids
    if ids and len(session.scalars(select(Artist.id).where(Artist.id.in_(ids))).all()) != len(ids):
        raise ValueError("a track artist does not exist")
    track.artist_credits.clear()
    session.flush()
    track.artist_credits.extend(TrackArtist(artist_id=artist_id, role=TrackArtistRole.PRIMARY, position=index + 1) for index, artist_id in enumerate(primary_ids))
    track.artist_credits.extend(TrackArtist(artist_id=artist_id, role=TrackArtistRole.FEATURED, position=index + 1) for index, artist_id in enumerate(featured_ids))
