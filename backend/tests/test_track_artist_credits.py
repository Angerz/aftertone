from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.database import Base, register_search_normalization
from app.main import (
    create_album,
    create_artist,
    create_favorite_song,
    get_album,
    get_artist,
    import_musicbrainz_release,
    list_artist_tracks,
    list_favorite_songs,
    search_tracks,
    update_track_artists,
)
from app.models.music import ReleaseType, TrackArtist
from app.schemas.music import (
    AlbumCreate,
    ArtistCreate,
    FavoriteSongEntryWrite,
    MusicBrainzImportRequest,
    TrackCreditsUpdate,
)


@pytest.fixture
def session():
    # In-memory synthetic catalogue: never use the application/personal engine.
    engine = create_engine("sqlite://")
    event.listen(engine, "connect", register_search_normalization)
    Base.metadata.create_all(engine)
    with Session(engine) as isolated:
        yield isolated
    engine.dispose()


def names(artists):
    return [artist.name for artist in artists]


def make_album(session, release_type="album", album_artists=None, count=2):
    return create_album(
        AlbumCreate.model_validate(
            {
                "title": "Synthetic project",
                "artists": [{"name": name} for name in (album_artists or ["A", "B"])],
                "year": 2026,
                "release_type": release_type,
                "tracks": [
                    {"position": index + 1, "title": f"Track {index + 1}"} for index in range(count)
                ],
            }
        ),
        session,
    )


@pytest.mark.parametrize("release_type", ["album", "compilation", "soundtrack"])
def test_inheritance_replacement_and_complete_ordered_artist_sets(session, release_type):
    album = make_album(session, release_type)
    a, b = album.artists
    c = create_artist(ArtistCreate(name="C"), session)
    d = create_artist(ArtistCreate(name="D"), session)
    assert names(album.tracks[0].primary_artists) == ["A", "B"]
    assert album.tracks[0].uses_album_artists

    update_track_artists(
        album.tracks[0].id,
        TrackCreditsUpdate(primary_artist_ids=[b.id, c.id], featured_artist_ids=[d.id]),
        session,
    )
    loaded = get_album(album.id, session)
    track = loaded.tracks[0]
    assert names(track.primary_artists) == ["B", "C"]
    assert names(track.featured_artists) == ["D"]
    assert not track.uses_album_artists
    assert names(loaded.artists) == ["A", "B"]
    assert track.title == "Track 1"

    assert [item.track_id for item in list_artist_tracks(a.id, session=session).items] == [
        album.tracks[1].id
    ]
    assert list_artist_tracks(b.id, session=session).total == 2
    assert list_artist_tracks(c.id, session=session).total == 1
    assert list_artist_tracks(d.id, session=session).total == 0
    appearance = get_artist(d.id, session).featured_appearances[0]
    assert names(appearance.primary_artists) == ["B", "C"]
    assert names(appearance.featured_artists) == ["D"]
    assert appearance.role == "featured" and appearance.score is None

    # Reading/formatting credits must not create implicit A-primary relationships.
    stored = session.scalars(
        select(TrackArtist).where(TrackArtist.track_id == track.id).order_by(TrackArtist.id)
    ).all()
    assert [(item.artist_id, item.role.value) for item in stored] == [
        (b.id, "primary"),
        (c.id, "primary"),
        (d.id, "featured"),
    ]


def test_favorite_rank_and_primary_ownership_do_not_change_with_featured_display(session):
    album = make_album(session, "compilation", ["Various Artists"])
    lead = create_artist(ArtistCreate(name="Actual performer"), session)
    guest = create_artist(ArtistCreate(name="Guest"), session)
    update_track_artists(
        album.tracks[0].id,
        TrackCreditsUpdate(primary_artist_ids=[lead.id], featured_artist_ids=[guest.id]),
        session,
    )
    entry = create_favorite_song(
        FavoriteSongEntryWrite(
            track_id=album.tracks[0].id,
            base_score=Decimal("10"),
            emotional_connection=Decimal("5"),
            replay_value=Decimal("5"),
            originality=Decimal("5"),
        ),
        session,
    )
    listed = list_favorite_songs(session=session)[0]
    assert listed.id == entry.id and listed.global_position == 1
    assert listed.final_score == Decimal("10")
    assert names(listed.artists) == ["Actual performer"]
    assert names(listed.featured_artists) == ["Guest"]
    found = search_tracks(q="Track 1", session=session)[0]
    assert names(found.artists) == ["Actual performer"]
    assert names(found.featured_artists) == ["Guest"]
    assert list_artist_tracks(guest.id, session=session).total == 0
    assert list_artist_tracks(album.artists[0].id, session=session).total == 1
    assert get_artist(guest.id, session).album_count == 0
    public = listed.model_dump(mode="json")
    assert [(item["id"], item["name"]) for item in public["featured_artists"]] == [
        (guest.id, "Guest")
    ]
    assert "normalized_name" not in public["featured_artists"][0]
    assert "is_active" not in public["featured_artists"][0]


def test_musicbrainz_import_persists_both_roles_and_inheritance_with_guests(session):
    imported = import_musicbrainz_release(
        MusicBrainzImportRequest.model_validate(
            {
                "musicbrainz_release_id": "synthetic-release",
                "title": "Synthetic soundtrack",
                "artists": [{"name": "A"}],
                "release_type": ReleaseType.SOUNDTRACK,
                "disc_count": 1,
                "tracks": [
                    {
                        "disc_number": 1,
                        "position": 1,
                        "title": "Inherited with guests",
                        "featured_artists": ["C", "D"],
                    },
                    {
                        "disc_number": 1,
                        "position": 2,
                        "title": "Another performer",
                        "primary_artists": ["B"],
                        "featured_artists": ["C"],
                    },
                    {
                        "disc_number": 1,
                        "position": 3,
                        "title": "Collaboration",
                        "primary_artists": ["A", "B"],
                        "featured_artists": ["D"],
                    },
                    {
                        "disc_number": 1,
                        "position": 4,
                        "title": "Explicit album-equivalent",
                        "primary_artists": ["A"],
                        "featured_artists": ["C"],
                    },
                ],
            }
        ),
        session,
    )
    assert [names(track.primary_artists) for track in imported.tracks] == [
        ["A"],
        ["B"],
        ["A", "B"],
        ["A"],
    ]
    assert [names(track.featured_artists) for track in imported.tracks] == [
        ["C", "D"],
        ["C"],
        ["D"],
        ["C"],
    ]
    assert [track.uses_album_artists for track in imported.tracks] == [True, False, False, True]
    assert imported.latest_revision is None
    public = get_album(imported.id, session).model_dump(mode="json")
    assert public["tracks"][0]["featured_artists"][0]["name"] == "C"


def test_summary_credits_are_public_and_loading_does_not_scale_per_track(session):
    album = make_album(session, count=20)
    guest = create_artist(ArtistCreate(name="Guest"), session)
    for track in album.tracks:
        update_track_artists(track.id, TrackCreditsUpdate(featured_artist_ids=[guest.id]), session)
    engine = session.get_bind()
    counts = []
    for page_size in (1, 20):
        statements = []

        def count_statement(*_args, statements=statements):
            statements.append(1)

        event.listen(engine, "before_cursor_execute", count_statement)
        try:
            with Session(engine) as reader:
                result = list_artist_tracks(
                    album.artists[0].id, page_size=page_size, session=reader
                )
                public = result.model_dump(mode="json")
        finally:
            event.remove(engine, "before_cursor_execute", count_statement)
        counts.append(len(statements))
        assert len(public["items"]) == page_size
        assert names(result.items[0].primary_artists) == ["A", "B"]
        assert public["items"][0]["featured_artists"][0]["id"] == guest.id
        assert public["items"][0]["featured_artists"][0]["name"] == "Guest"
    assert counts[0] == counts[1]
