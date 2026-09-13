from __future__ import annotations

from app.integrations import musicbrainz
from app.models.music import ReleaseType


class Response:
    status_code = 200

    def __init__(self, payload, status_code=200, headers=None): self.payload = payload; self.status_code = status_code; self.headers = headers or {}
    def raise_for_status(self): return None
    def json(self): return self.payload


class Client:
    def __init__(self, payload): self.payload = payload
    def get(self, *_args, **_kwargs): return Response(self.payload)


class RetryingClient:
    def __init__(self): self.calls = 0
    def get(self, *_args, **_kwargs):
        self.calls += 1
        return Response({"releases": []}, status_code=503 if self.calls == 1 else 200)


def test_search_and_multi_disc_preview_are_normalized(monkeypatch) -> None:
    monkeypatch.setattr(musicbrainz, "_last_request_at", 0.0)
    results = musicbrainz.search_releases("Low", "David Bowie", Client({"releases": [{"id": "release-id", "title": "Low", "date": "1977-01-14", "country": "GB", "artist-credit": [{"name": "David Bowie"}], "release-group": {"id": "group-id", "primary-type": "Album"}, "media": [{"track-count": 2}]}]}))
    assert results[0]["musicbrainz_release_id"] == "release-id"
    assert results[0]["year"] == 1977
    payload = {"id": "release-id", "title": "Double", "date": "2000", "artist-credit": [{"name": "Artist"}], "release-group": {"primary-type": "EP"}, "media": [{"format": "CD", "tracks": [{"position": 1, "title": "One"}, {"position": 2, "title": "Two"}]}, {"format": "CD", "tracks": [{"position": 1, "title": "Three"}]}]}
    preview = musicbrainz.release_preview("release-id", Client(payload))
    assert preview["release_type"] == ReleaseType.EP
    assert preview["disc_count"] == 2
    assert [(track["disc_number"], track["position"], track["title"]) for track in preview["tracks"]] == [(1, 1, "One"), (1, 2, "Two"), (2, 1, "Three")]


def test_search_retries_one_temporary_musicbrainz_failure(monkeypatch) -> None:
    monkeypatch.setattr(musicbrainz, "_last_request_at", 0.0)
    monkeypatch.setattr(musicbrainz.time, "sleep", lambda _seconds: None)
    client = RetryingClient()
    assert musicbrainz.search_releases("Microdosis", "Mora", client) == []
    assert client.calls == 2
