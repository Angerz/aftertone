from __future__ import annotations

import pytest

from app.integrations import musicbrainz
from app.models.music import ReleaseType


class Response:
    status_code = 200

    def __init__(self, payload, status_code=200, headers=None):
        self.payload = payload
        self.status_code = status_code
        self.headers = headers or {}

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class Client:
    def __init__(self, payload):
        self.payload = payload

    def get(self, *_args, **_kwargs):
        return Response(self.payload)


class RetryingClient:
    def __init__(self):
        self.calls = 0

    def get(self, *_args, **_kwargs):
        self.calls += 1
        return Response({"releases": []}, status_code=503 if self.calls == 1 else 200)


@pytest.mark.parametrize("join", [" feat. ", " ft. ", " featuring "])
def test_track_preview_preserves_explicit_primary_and_featured_roles(join, monkeypatch):
    monkeypatch.setattr(musicbrainz, "_last_request_at", 0.0)
    payload = {
        "id": "synthetic-release",
        "title": "Compilation",
        "artist-credit": [{"name": "Various Artists"}],
        "media": [
            {
                "tracks": [
                    {
                        "position": 1,
                        "title": "Independent title",
                        "artist-credit": [
                            {"name": "A", "joinphrase": " & "},
                            {"name": "B", "joinphrase": join},
                            {"name": "C", "joinphrase": " & "},
                            {"name": "D"},
                        ],
                        "recording": {"artist-credit": [{"name": "Not the track credit"}]},
                    }
                ]
            }
        ],
    }
    track = musicbrainz.release_preview("synthetic-release", Client(payload))["tracks"][0]
    assert track["primary_artists"] == ["A", "B"]
    assert track["featured_artists"] == ["C", "D"]
    assert track["title"] == "Independent title"


def test_recording_fallback_and_ambiguous_joins_do_not_guess_featured_roles(monkeypatch):
    monkeypatch.setattr(musicbrainz, "_last_request_at", 0.0)
    payload = {
        "id": "synthetic-release",
        "artist-credit": [{"name": "A"}],
        "media": [
            {
                "tracks": [
                    {
                        "title": "A feat. B is just a title",
                        "recording": {
                            "artist-credit": [
                                {"name": "A", "joinphrase": " with "},
                                {"name": "B"},
                            ]
                        },
                    },
                    {"title": "Inherited"},
                    {
                        "title": "Guests only differ",
                        "artist-credit": [
                            {"name": "A", "joinphrase": " feat. "},
                            {"name": "Guest"},
                        ],
                    },
                ]
            }
        ],
    }
    tracks = musicbrainz.release_preview("synthetic-release", Client(payload))["tracks"]
    assert tracks[0]["primary_artists"] == ["A", "B"]
    assert tracks[0]["featured_artists"] == []
    assert tracks[1]["primary_artists"] == [] and tracks[1]["featured_artists"] == []
    assert tracks[2]["primary_artists"] == [] and tracks[2]["featured_artists"] == ["Guest"]


def test_search_and_multi_disc_preview_are_normalized(monkeypatch) -> None:
    monkeypatch.setattr(musicbrainz, "_last_request_at", 0.0)
    results = musicbrainz.search_releases(
        "Low",
        "David Bowie",
        Client(
            {
                "releases": [
                    {
                        "id": "release-id",
                        "title": "Low",
                        "date": "1977-01-14",
                        "country": "GB",
                        "artist-credit": [{"name": "David Bowie"}],
                        "release-group": {"id": "group-id", "primary-type": "Album"},
                        "media": [{"track-count": 2}],
                    }
                ]
            }
        ),
    )
    assert results[0]["musicbrainz_release_id"] == "release-id"
    assert results[0]["year"] == 1977
    payload = {
        "id": "release-id",
        "title": "Double",
        "date": "2000",
        "artist-credit": [{"name": "Artist"}],
        "release-group": {"primary-type": "EP"},
        "media": [
            {
                "format": "CD",
                "tracks": [{"position": 1, "title": "One"}, {"position": 2, "title": "Two"}],
            },
            {"format": "CD", "tracks": [{"position": 1, "title": "Three"}]},
        ],
    }
    preview = musicbrainz.release_preview("release-id", Client(payload))
    assert preview["release_type"] == ReleaseType.EP
    assert preview["disc_count"] == 2
    assert preview["release_date"] is None
    assert [
        (track["disc_number"], track["position"], track["title"]) for track in preview["tracks"]
    ] == [(1, 1, "One"), (1, 2, "Two"), (2, 1, "Three")]


def test_release_preview_keeps_only_complete_musicbrainz_dates() -> None:
    payload = {
        "id": "release-id",
        "title": "Single",
        "date": "2000-02-27",
        "artist-credit": [{"name": "Artist"}],
        "release-group": {"primary-type": "Album"},
        "media": [{"format": "CD", "tracks": [{"position": 1, "title": "One"}]}],
    }
    preview = musicbrainz.release_preview("release-id", Client(payload))
    assert preview["year"] == 2000
    assert preview["release_date"].isoformat() == "2000-02-27"


def test_search_retries_one_temporary_musicbrainz_failure(monkeypatch) -> None:
    monkeypatch.setattr(musicbrainz, "_last_request_at", 0.0)
    monkeypatch.setattr(musicbrainz.time, "sleep", lambda _seconds: None)
    client = RetryingClient()
    assert musicbrainz.search_releases("Microdosis", "Mora", client) == []
    assert client.calls == 2


def test_artist_search_and_preview_map_only_compatible_metadata() -> None:
    results = musicbrainz.search_artists(
        "Beyoncé",
        Client(
            {
                "artists": [
                    {
                        "id": "artist-id",
                        "name": "Beyoncé",
                        "type": "Person",
                        "country": "US",
                        "disambiguation": "American singer",
                        "life-span": {"begin": "1981-09-04"},
                    }
                ]
            }
        ),
    )
    assert results == [
        {
            "musicbrainz_artist_id": "artist-id",
            "name": "Beyoncé",
            "artist_type": "person",
            "country_code": "US",
            "disambiguation": "American singer",
            "life_span_begin": "1981-09-04",
            "life_span_end": None,
        }
    ]
    group = musicbrainz.artist_preview(
        "group-id",
        Client(
            {
                "id": "group-id",
                "name": "Daft Punk",
                "type": "Group",
                "country": "FR",
                "life-span": {"begin": "1993", "end": "2021"},
            }
        ),
    )
    assert group["artist_type"] == "group"
    assert (group["formed_year"], group["dissolved_year"]) == (1993, 2021)
    assert group["birth_date"] is None
