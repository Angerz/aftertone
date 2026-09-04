from __future__ import annotations

import os
from decimal import Decimal
from pathlib import Path

os.environ["AFTERTONE_DATABASE_URL"] = f"sqlite:///{Path(__file__).parent / 'aftertone-api-test.sqlite3'}"

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.database import Base, SessionLocal, engine
from app.main import create_album, create_revision, get_album, get_revision, list_albums, list_revisions
from app.ratings.calculator import TrackScore, calculate_rating
from app.schemas.music import AlbumCreate, RatingRevisionCreate


@pytest.fixture(autouse=True)
def database() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


def album_payload(title: str = "Grace") -> dict[str, object]:
    return {
        "title": title, "artist": "Jeff Buckley", "year": 1994, "release_type": "album",
        "tracks": [{"position": 2, "title": "Grace"}, {"position": 1, "title": "Mojo Pin"}],
    }


def create_test_album(title: str = "Grace"):
    with SessionLocal() as session:
        return create_album(AlbumCreate.model_validate(album_payload(title)), session)


def revision_payload(album) -> dict[str, object]:
    return {
        "coherence": "7", "coherence_notes": "Cohesive sequencing.", "emotion": "10",
        "emotion_notes": "Overwhelming.", "album_notes": "A complete note.",
        "tracks": [
            {"track_id": album.tracks[0].id, "score": "10", "include_in_pre_rating": True, "notes": "Opener."},
            {"track_id": album.tracks[1].id, "score": "9", "include_in_pre_rating": False, "notes": "Title track."},
        ],
    }


def test_create_get_and_list_albums_with_ordered_tracks() -> None:
    created = create_test_album()
    assert [track.position for track in created.tracks] == [1, 2]
    assert created.year == 1994
    with SessionLocal() as session:
        found = get_album(created.id, session)
        assert [track.title for track in found.tracks] == ["Mojo Pin", "Grace"]
        listed = list_albums(session)
        assert [album.id for album in listed] == [created.id]
        assert listed[0].latest_revision is None


def test_album_list_includes_only_the_latest_revision_summary() -> None:
    album = create_test_album()
    first_payload = RatingRevisionCreate.model_validate(revision_payload(album))
    with SessionLocal() as session:
        first = create_revision(album.id, first_payload, session)
    second_data = revision_payload(album)
    second_data["emotion"] = "5"
    with SessionLocal() as session:
        second = create_revision(album.id, RatingRevisionCreate.model_validate(second_data), session)
        latest = list_albums(session)[0].latest_revision
    assert latest is not None
    assert latest.id == second.id
    assert latest.id != first.id
    assert latest.pre_rating == second.pre_rating
    assert latest.final_rating == second.final_rating


def test_create_and_read_complete_calculated_revision() -> None:
    album = create_test_album()
    payload = RatingRevisionCreate.model_validate(revision_payload(album))
    with SessionLocal() as session:
        revision = create_revision(album.id, payload, session)
        expected = calculate_rating([TrackScore(Decimal("10"), True), TrackScore(Decimal("9"), False)],
                                    coherence=Decimal("7"), emotion=Decimal("10"))
        assert revision.pre_rating == expected.pre_rating
        assert revision.bad_experience == expected.bad_experience
        assert revision.final_rating == expected.final_rating
        assert revision.album_notes == "A complete note."
        assert revision.coherence_notes == "Cohesive sequencing."
        assert revision.emotion_notes == "Overwhelming."
        assert revision.tracks[0].notes == "Opener."
        assert revision.tracks[1].include_in_pre_rating is False
    with SessionLocal() as session:
        fetched = get_revision(album.id, revision.id, session)
        assert fetched == revision
        assert list_revisions(album.id, session)[0].id == revision.id

    no_pre_payload = revision_payload(album)
    for track in no_pre_payload["tracks"]:
        track["include_in_pre_rating"] = False
    with SessionLocal() as session:
        no_pre_revision = create_revision(album.id, RatingRevisionCreate.model_validate(no_pre_payload), session)
        assert no_pre_revision.id != revision.id
        assert no_pre_revision.pre_rating is None
        assert no_pre_revision.bad_experience is None
        assert no_pre_revision.final_rating is None
        assert len(list_revisions(album.id, session)) == 2


@pytest.mark.parametrize(("field", "value"), [("coherence", "10.1"), ("coherence", "-0.1"),
                                                   ("emotion", "10.1"), ("emotion", "-0.1")])
def test_revision_rejects_out_of_range_album_scores(field: str, value: str) -> None:
    album = create_test_album()
    payload = revision_payload(album)
    payload[field] = value
    with pytest.raises(ValidationError):
        RatingRevisionCreate.model_validate(payload)


def test_revision_rejects_client_supplied_calculated_value() -> None:
    payload = revision_payload(create_test_album())
    payload["bad_experience"] = "1"
    with pytest.raises(ValidationError):
        RatingRevisionCreate.model_validate(payload)


def test_revision_validates_complete_unique_album_tracklist() -> None:
    album = create_test_album()
    other_album = create_test_album("Sketches")
    payload = revision_payload(album)
    payload["tracks"][0]["score"] = "10.1"
    with pytest.raises(ValidationError):
        RatingRevisionCreate.model_validate(payload)
    payload["tracks"][0]["score"] = "10"
    payload["tracks"].append(payload["tracks"][0].copy())
    with SessionLocal() as session, pytest.raises(HTTPException) as duplicate:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert duplicate.value.status_code == 422
    payload["tracks"].pop()
    payload["tracks"][1]["track_id"] = 99999
    with SessionLocal() as session, pytest.raises(HTTPException) as nonexistent:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert nonexistent.value.status_code == 422
    payload["tracks"][1]["track_id"] = other_album.tracks[0].id
    with SessionLocal() as session, pytest.raises(HTTPException) as foreign:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert foreign.value.status_code == 422
    payload["tracks"] = payload["tracks"][:1]
    with SessionLocal() as session, pytest.raises(HTTPException) as incomplete:
        create_revision(album.id, RatingRevisionCreate.model_validate(payload), session)
    assert incomplete.value.status_code == 422


def test_revision_and_album_not_found_or_mismatched_path() -> None:
    with SessionLocal() as session, pytest.raises(HTTPException) as missing_album:
        get_album(404, session)
    assert missing_album.value.status_code == 404
    album = create_test_album()
    with SessionLocal() as session:
        revision = create_revision(album.id, RatingRevisionCreate.model_validate(revision_payload(album)), session)
    other_album = create_test_album("Sketches")
    with SessionLocal() as session, pytest.raises(HTTPException) as wrong_album:
        get_revision(other_album.id, revision.id, session)
    assert wrong_album.value.status_code == 404
