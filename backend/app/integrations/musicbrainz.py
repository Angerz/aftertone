from __future__ import annotations

import os
import threading
import time
from typing import Any

import httpx

from app.models.music import ReleaseType


MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2"
_request_lock = threading.Lock()
_last_request_at = 0.0


class MusicBrainzError(ValueError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _user_agent() -> str:
    contact = os.getenv("AFTERTONE_MUSICBRAINZ_CONTACT", "https://github.com/aftertone")
    return f"Aftertone/0.1.0 ({contact})"


def _request(path: str, params: dict[str, str], client: httpx.Client | None = None) -> dict[str, Any]:
    global _last_request_at
    own_client = client is None
    active_client = client or httpx.Client(timeout=httpx.Timeout(10.0), headers={"User-Agent": _user_agent()})
    try:
        for attempt in range(2):
            with _request_lock:
                delay = 1.0 - (time.monotonic() - _last_request_at)
                if delay > 0:
                    time.sleep(delay)
                try:
                    response = active_client.get(f"{MUSICBRAINZ_URL}{path}", params={**params, "fmt": "json"})
                finally:
                    _last_request_at = time.monotonic()
            if response.status_code not in {429, 503}:
                break
            if attempt == 0:
                retry_after = response.headers.get("retry-after")
                try:
                    time.sleep(max(1.0, min(float(retry_after), 10.0)) if retry_after else 1.0)
                except ValueError:
                    time.sleep(1.0)
        if response.status_code in {429, 503}:
            raise MusicBrainzError("MusicBrainz is temporarily unavailable. Try again shortly.", status_code=503)
        if response.status_code == 404:
            raise MusicBrainzError("MusicBrainz release was not found.", status_code=404)
        response.raise_for_status()
        return response.json()
    except httpx.TimeoutException as error:
        raise MusicBrainzError("MusicBrainz request timed out.") from error
    except httpx.HTTPError as error:
        raise MusicBrainzError("Could not reach MusicBrainz.") from error
    except ValueError as error:
        if isinstance(error, MusicBrainzError):
            raise
        raise MusicBrainzError("MusicBrainz returned an invalid response.") from error
    finally:
        if own_client:
            active_client.close()


def _artist_names(credits: list[dict[str, Any]] | None) -> list[str]:
    return [str(item.get("name") or item.get("artist", {}).get("name", "")).strip() for item in credits or [] if str(item.get("name") or item.get("artist", {}).get("name", "")).strip()]


def _year(date: str | None) -> int | None:
    if date and len(date) >= 4 and date[:4].isdigit():
        return int(date[:4])
    return None


def map_release_type(primary_type: str | None, secondary_types: list[str] | None = None) -> ReleaseType:
    primary = (primary_type or "").casefold()
    secondary = {item.casefold() for item in secondary_types or []}
    if "live" in secondary:
        return ReleaseType.LIVE
    if "compilation" in secondary or primary == "compilation":
        return ReleaseType.COMPILATION
    if primary == "ep":
        return ReleaseType.EP
    if primary == "mixtape/street":
        return ReleaseType.MIXTAPE
    return ReleaseType.ALBUM


def _relevant_media(media: list[dict[str, Any]]) -> list[dict[str, Any]]:
    video_formats = {"dvd", "blu-ray", "blu ray", "vhs", "video"}
    return [item for item in media if item.get("tracks") and str(item.get("format") or "").casefold() not in video_formats]


def search_releases(query: str, artist: str | None = None, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    title = query.strip()
    if not title:
        raise MusicBrainzError("Enter an album title to search.", status_code=422)
    parts = [f'release:"{title.replace(chr(34), "")}"']
    if artist and artist.strip():
        parts.append(f'artist:"{artist.strip().replace(chr(34), "")}"')
    payload = _request("/release", {"query": " AND ".join(parts), "limit": "12"}, client)
    results = []
    for release in payload.get("releases", []):
        group = release.get("release-group") or {}
        media = release.get("media") or []
        results.append({
            "musicbrainz_release_id": release["id"], "musicbrainz_release_group_id": group.get("id"),
            "title": release.get("title", "Untitled"), "artists": _artist_names(release.get("artist-credit")),
            "date": release.get("date"), "year": _year(release.get("date")), "country": release.get("country"),
            "release_type": group.get("primary-type"), "disc_count": len(media) or 1,
            "track_count": sum(int(item.get("track-count", 0)) for item in media),
            "disambiguation": release.get("disambiguation") or group.get("disambiguation"),
        })
    return results


def release_preview(release_id: str, client: httpx.Client | None = None) -> dict[str, Any]:
    payload = _request(f"/release/{release_id}", {"inc": "artist-credits+recordings+release-groups+media"}, client)
    group = payload.get("release-group") or {}
    media = _relevant_media(payload.get("media") or [])
    tracks = []
    album_artists = _artist_names(payload.get("artist-credit"))
    for disc_number, medium in enumerate(media, start=1):
        for fallback_position, track in enumerate(medium.get("tracks") or [], start=1):
            track_artists = _artist_names(track.get("artist-credit") or (track.get("recording") or {}).get("artist-credit"))
            tracks.append({
                "disc_number": disc_number, "position": int(track.get("position") or fallback_position),
                "title": track.get("title") or (track.get("recording") or {}).get("title") or "Untitled",
                "primary_artists": track_artists if track_artists != album_artists else [],
            })
    if not tracks:
        raise MusicBrainzError("This MusicBrainz release has no importable audio tracks.", status_code=422)
    return {
        "musicbrainz_release_id": payload["id"], "title": payload.get("title", "Untitled"),
        "artists": album_artists, "year": _year(payload.get("date")),
        "release_type": map_release_type(group.get("primary-type"), group.get("secondary-types")),
        "source_release_type": group.get("primary-type"), "disc_count": len(media), "tracks": tracks,
        "cover_url": f"https://coverartarchive.org/release/{payload['id']}/front",
    }
