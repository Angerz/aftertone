"""Branding files must be served as files, never the SPA's index.html."""

import os
import subprocess
import sys
from pathlib import Path


def test_branding_files_are_public_and_confined_to_their_directory(tmp_path: Path) -> None:
    frontend = tmp_path / "frontend"
    branding = frontend / "branding"
    branding.mkdir(parents=True)
    (frontend / "index.html").write_text("<html>synthetic app</html>")
    (frontend / "private.txt").write_text("must not be served")
    (branding / "favicon-32.png").write_bytes(b"\x89PNG\r\n\x1a\nsynthetic icon")
    (branding / "site.webmanifest").write_text('{"name":"Aftertone","icons":[]}')
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("AFTERTONE_", "RAILWAY_"))
    }
    env.update(
        AFTERTONE_ENV="development",
        AFTERTONE_FRONTEND_DIR=str(frontend),
        AFTERTONE_COVER_DIR=str(tmp_path / "media"),
        AFTERTONE_DATABASE_URL=f"sqlite:///{tmp_path / 'unused.sqlite3'}",
        PYTHONPATH=str(Path(__file__).resolve().parents[2]),
    )
    subprocess.run(
        [
            sys.executable,
            "-c",
            """
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as client:
    icon = client.get('/branding/favicon-32.png')
    assert icon.status_code == 200
    assert icon.headers['content-type'] == 'image/png'
    assert icon.content == b'\\x89PNG\\r\\n\\x1a\\nsynthetic icon'
    assert client.head('/branding/favicon-32.png').status_code == 200
    manifest = client.get('/branding/site.webmanifest')
    assert manifest.status_code == 200
    assert manifest.headers['content-type'].startswith('application/manifest+json')
    assert manifest.json()['name'] == 'Aftertone'
    assert client.get('/branding/missing.png').status_code == 404
    assert client.get('/branding/%2e%2e/private.txt').status_code == 404
    assert client.post('/branding/favicon-32.png').status_code == 405
    assert client.get('/library').text == '<html>synthetic app</html>'
    assert client.get('/api/missing').status_code == 404
""",
        ],
        env=env,
        check=True,
        timeout=30,
        capture_output=True,
        text=True,
    )
    assert not (tmp_path / "unused.sqlite3").exists()
