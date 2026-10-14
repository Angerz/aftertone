"""Exercise authorization through ASGI; direct endpoint calls bypass dependencies."""

import time
from io import BytesIO
from typing import get_args, get_origin
from zipfile import ZipFile

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import PUBLIC_READ_ROUTES, OwnerSession, cookie_name, digest, password_hasher
from app.database import Base, SessionLocal, engine
from app.imports.legacy_excel import preview_workbook
from app.main import app
from app.services.covers import CoverError, _validate_remote_url

ORIGIN = "http://127.0.0.1:5177"
PASSWORD = "synthetic-test-password-only"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("AFTERTONE_OWNER_PASSWORD_HASH", password_hasher.hash(PASSWORD))
    Base.metadata.create_all(engine)
    with TestClient(app) as client:
        yield client
    Base.metadata.drop_all(engine)


def sign_in(client):
    response = client.post(
        "/api/auth/login", json={"password": PASSWORD}, headers={"Origin": ORIGIN}
    )
    assert response.status_code == 200, response.text
    client.headers.update({"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]})
    return response


def test_every_administrative_route_rejects_anonymous_requests(client):
    protected = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if route.path.startswith("/api/auth"):
            continue
        methods = route.methods - {"GET", "HEAD", "OPTIONS"}
        if route.path.startswith(("/api/metadata/", "/api/legacy-ratings/", "/api/tracks/search")):
            methods |= {"GET"} & route.methods
        for method in methods:
            path = route.path
            for param in route.param_convertors:
                path = path.replace("{" + param + "}", "1")
            response = client.request(method, path, json={})
            assert response.status_code == 401, (method, path, response.text)
            protected.append((method, path))
    assert len(protected) >= 25


@pytest.mark.parametrize(
    "path",
    [
        "/health",
        "/api/albums",
        "/api/albums/facets",
        "/api/albums/summary",
        "/api/artists",
        "/api/favorite-songs",
    ],
)
def test_public_reads(client, path):
    assert client.get(path).status_code == 200


def test_new_get_routes_are_private_by_default(client):
    @app.get("/api/security-test/private")
    def private_probe():
        return {"private": "synthetic"}

    route = app.routes[-1]
    # Test the API route before the production SPA fallback, if a build exists.
    app.router.routes.remove(route)
    app.router.routes.insert(0, route)
    try:
        assert client.get("/api/security-test/private").status_code == 401
        sign_in(client)
        assert client.get("/api/security-test/private").status_code == 200
    finally:
        app.router.routes.remove(route)


def test_public_read_models_declare_explicit_field_projections():
    for route in app.routes:
        if (
            isinstance(route, APIRoute)
            and "GET" in route.methods
            and route.path in PUBLIC_READ_ROUTES - {"/health", "/api/auth/session"}
        ):
            model = route.response_model
            if get_origin(model) is list:
                model = get_args(model)[0]
            assert model._public_fields is not None, route.path


def test_invalid_login_and_login_csrf(client):
    assert client.post("/api/auth/login", json={"password": PASSWORD}).status_code == 403
    assert (
        client.post(
            "/api/auth/login",
            json={"password": PASSWORD},
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/auth/login", json={"password": "wrong"}, headers={"Origin": ORIGIN}
        ).status_code
        == 401
    )


def test_session_csrf_expiry_rotation_and_logout(client, monkeypatch):
    response = sign_in(client)
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie and "Path=/" in cookie
    token = client.cookies[cookie_name()]
    with SessionLocal() as session:
        stored = session.get(OwnerSession, digest(token))
        assert stored and stored.token_hash != token
    assert client.get("/api/auth/session").json()["authenticated"] is True
    assert client.post("/api/artists", json={"name": "Synthetic"}).status_code == 201
    assert (
        client.post(
            "/api/artists", json={"name": "Blocked"}, headers={"X-CSRF-Token": "wrong"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/artists", json={"name": "Blocked"}, headers={"Origin": "https://angerz.dev"}
        ).status_code
        == 403
    )
    saved_csrf = client.headers.pop("x-csrf-token")
    assert client.post("/api/artists", json={"name": "Blocked"}).status_code == 403
    client.headers["X-CSRF-Token"] = saved_csrf
    sign_in(client)
    with TestClient(app) as old_client:
        old_client.cookies.set(cookie_name(), token)
        assert old_client.get("/api/auth/session").json()["authenticated"] is False
    assert client.post("/api/auth/logout").status_code == 200
    client.cookies.set(cookie_name(), token)
    assert client.post("/api/artists", json={"name": "Blocked"}).status_code == 401
    sign_in(client)
    with SessionLocal() as session:
        stored = session.scalar(select(OwnerSession))
        stored.expires_at = int(time.time()) - 1
        session.commit()
    assert client.post("/api/artists", json={"name": "Blocked"}).status_code == 401
    sign_in(client)
    monkeypatch.setenv(
        "AFTERTONE_OWNER_PASSWORD_HASH", password_hasher.hash("replacement-test-password")
    )
    assert client.get("/api/auth/session").json()["authenticated"] is False


def test_secure_production_cookie(client, monkeypatch):
    monkeypatch.setenv("AFTERTONE_ENV", "production")
    monkeypatch.setenv("AFTERTONE_WEB_ORIGIN", "https://aftrtone.angerz.dev")
    with TestClient(app, base_url="https://aftrtone.angerz.dev") as secure:
        response = secure.post(
            "/api/auth/login",
            json={"password": PASSWORD},
            headers={"Origin": "https://aftrtone.angerz.dev"},
        )
        assert response.status_code == 200
        cookie = response.headers["set-cookie"]
        assert (
            "__Host-aftertone_session=" in cookie and "Secure" in cookie and "Domain=" not in cookie
        )
        assert secure.get("/api/auth/session").json()["authenticated"] is True


def test_persistent_global_login_limit(client):
    for _ in range(10):
        assert (
            client.post(
                "/api/auth/login", json={"password": "wrong"}, headers={"Origin": ORIGIN}
            ).status_code
            == 401
        )
    with TestClient(app) as other:
        response = other.post(
            "/api/auth/login",
            json={"password": PASSWORD},
            headers={"Origin": ORIGIN, "X-Forwarded-For": "192.0.2.1"},
        )
        assert response.status_code == 429 and response.headers["retry-after"] == "300"


def test_public_responses_strip_journal_text_in_nested_objects(client):
    sign_in(client)
    album = client.post(
        "/api/albums",
        json={
            "title": "Synthetic album",
            "artists": [{"name": "Synthetic artist"}],
            "tracks": [{"title": "Synthetic track", "position": 1}],
        },
    ).json()
    album_id = album["id"]
    track_id = album["tracks"][0]["id"]
    revision = client.post(
        f"/api/albums/{album_id}/revisions",
        json={
            "coherence": "7",
            "emotion": "8",
            "album_notes": "PRIVATE ALBUM",
            "coherence_notes": "PRIVATE COHERENCE",
            "emotion_notes": "PRIVATE EMOTION",
            "tracks": [{"track_id": track_id, "score": "9", "notes": "PRIVATE TRACK"}],
        },
    ).json()
    assert revision["album_notes"] == "PRIVATE ALBUM"
    client.patch(f"/api/albums/{album_id}/revisit", json={"reason": "PRIVATE REVISIT"})
    favorite = client.post(
        "/api/favorite-songs",
        json={
            "track_id": track_id,
            "base_score": "9",
            "emotional_connection": "5",
            "replay_value": "5",
            "originality": "4",
            "notes": "PRIVATE FAVORITE",
        },
    )
    assert favorite.status_code == 201
    with TestClient(app) as public:
        for path in [
            f"/api/albums/{album_id}",
            "/api/albums",
            f"/api/albums/{album_id}/revisions",
            f"/api/albums/{album_id}/revisions/{revision['id']}",
            "/api/favorite-songs",
            f"/api/favorite-songs/{favorite.json()['id']}",
            "/api/artists",
            f"/api/artists/{album['artists'][0]['id']}",
            f"/api/artists/{album['artists'][0]['id']}/tracks",
        ]:
            response = public.get(path)
            assert response.status_code == 200, response.text
            assert "PRIVATE" not in response.text
            assert response.headers["cache-control"].find("no-store") >= 0
        public_artist = public.get(f"/api/artists/{album['artists'][0]['id']}").json()
        assert not {"is_active", "is_unused", "normalized_name"} & public_artist.keys()
        assert "created_at" not in public.get(f"/api/albums/{album_id}").json()
        assert public.get("/api/auth/session").json() == {
            "authenticated": False,
            "csrf_token": None,
        }
        assert public.get("/api/legacy-ratings/1").status_code == 401
        assert public.get("/api/metadata/musicbrainz/artists/search?query=test").status_code == 401
        assert (
            public.get(f"/api/albums/{album_id}/revisions/{revision['id']}").json()["tracks"][0][
                "score"
            ]
            == 9.0
        )
    assert (
        client.get(f"/api/albums/{album_id}/revisions/{revision['id']}").json()["album_notes"]
        == "PRIVATE ALBUM"
    )
    assert client.post("/api/auth/logout").status_code == 200
    after_logout = client.get(f"/api/albums/{album_id}/revisions/{revision['id']}")
    assert "PRIVATE" not in after_logout.text
    assert client.post("/api/artists", json={"name": "Blocked after logout"}).status_code == 401


def test_legacy_summary_exposes_ratings_without_import_administration(client):
    from app.models.music import LegacyRating

    sign_in(client)
    album = client.post(
        "/api/albums",
        json={
            "title": "Legacy",
            "artists": [{"name": "Synthetic"}],
            "tracks": [{"position": 1, "title": "One"}],
        },
    ).json()
    with SessionLocal() as session:
        session.add(
            LegacyRating(
                album_id=album["id"],
                legacy_final_rating=8,
                coherence=7,
                emotion=8,
                extracted_scores=["8"],
                pre_formula="8",
                reconciliation_status="pending",
            )
        )
        session.commit()
    with TestClient(app) as public:
        summary = public.get(f"/api/albums/{album['id']}").json()["latest_legacy_rating"]
        assert summary == {"legacy_final_rating": 8.0, "computed_final_rating": None}
    assert "id" in client.get(f"/api/albums/{album['id']}").json()["latest_legacy_rating"]


def test_real_anonymous_multipart_uploads_denied(client):
    for path, method in [
        ("/api/albums/1/cover", "PUT"),
        ("/api/artists/1/image", "PUT"),
        ("/api/imports/legacy-ratings/preview", "POST"),
        ("/api/imports/legacy-ratings/commit", "POST"),
    ]:
        assert (
            client.request(method, path, files={"file": ("test.xlsx", b"untrusted")}).status_code
            == 401
        )


def test_body_limit_with_and_without_content_length(client):
    assert (
        client.post(
            "/api/albums", content=b"", headers={"Content-Length": str(13 * 1024 * 1024)}
        ).status_code
        == 413
    )
    response = client.post("/api/albums", content=iter([b"x" * 1024 * 1024] * 13))
    assert response.status_code == 413


def test_workbook_expansion_limits():
    data = BytesIO()
    with ZipFile(data, "w") as archive:
        for i in range(501):
            archive.writestr(str(i), b"")
    with SessionLocal() as session, pytest.raises(ValueError, match="expanded size"):
        preview_workbook(data.getvalue(), session)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/x",
        "http://169.254.169.254/x",
        "http://[::1]/x",
        "file:///etc/passwd",
        "http://example.com:123/x",
        "http://user:password@example.com/x",
        "http://example.com:bad/x",
    ],
)
def test_remote_url_validation(url):
    with pytest.raises(CoverError):
        _validate_remote_url(url)


def test_download_pins_validated_ip_and_preserves_tls_hostname(monkeypatch, tmp_path):
    import httpx
    from PIL import Image

    from app.services import covers

    data = BytesIO()
    Image.new("RGB", (10, 10)).save(data, format="PNG")
    seen = []

    def handle(request):
        seen.append(request)
        return httpx.Response(200, headers={"content-type": "image/png"}, content=data.getvalue())

    real_client = httpx.Client
    monkeypatch.setenv("AFTERTONE_COVER_DIR", str(tmp_path))
    monkeypatch.setattr(
        covers.socket,
        "getaddrinfo",
        lambda *a, **kw: [(None, None, None, None, ("93.184.216.34", 443))],
    )
    monkeypatch.setattr(
        covers.httpx,
        "Client",
        lambda **kw: real_client(transport=httpx.MockTransport(handle), **kw),
    )
    assert (tmp_path / covers.download_cover_from_url("https://images.example/cover.png")).is_file()
    assert seen[0].url.host == "93.184.216.34"
    assert seen[0].headers["host"] == "images.example"
    assert seen[0].extensions["sni_hostname"] == "images.example"


def test_image_bombs_rejected(monkeypatch):
    from PIL import Image

    from app.services.covers import save_cover_data

    data = BytesIO()
    Image.new("RGB", (20, 20)).save(data, format="PNG")
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(CoverError):
        save_cover_data(data.getvalue(), "image/png")


@pytest.mark.parametrize(
    "path",
    [
        "/api/albums?revisit=true",
        "/api/albums/summary?revisit=true",
        "/api/albums?revisit=t",
        "/api/albums/summary?revisit=y",
    ],
)
def test_anonymous_cannot_infer_private_revisit_state_from_filters(client, path):
    assert client.get(path).status_code == 401
    sign_in(client)
    assert client.get(path).status_code == 200


@pytest.mark.parametrize("query", ["active=true", "active=false", "unused=true"])
def test_artist_maintenance_filters_require_owner(client, query):
    assert client.get(f"/api/artists?{query}").status_code == 401
    sign_in(client)
    assert client.get(f"/api/artists?{query}").status_code == 200


def test_production_configuration_fails_closed(monkeypatch):
    from app.config import validate_configuration

    monkeypatch.setenv("AFTERTONE_ENV", "prod")
    with pytest.raises(RuntimeError, match="AFTERTONE_ENV"):
        validate_configuration()
    monkeypatch.setenv("AFTERTONE_ENV", "production")
    monkeypatch.delenv("AFTERTONE_OWNER_PASSWORD_HASH", raising=False)
    with pytest.raises(RuntimeError, match="PASSWORD_HASH"):
        validate_configuration()
    monkeypatch.setenv("AFTERTONE_OWNER_PASSWORD_HASH", password_hasher.hash(PASSWORD))
    monkeypatch.setenv("AFTERTONE_WEB_ORIGIN", "http://aftrtone.angerz.dev")
    with pytest.raises(RuntimeError, match="HTTPS"):
        validate_configuration()
