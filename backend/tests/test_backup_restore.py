"""Round-trip actual Alembic schema and synthetic journal/media through the CLI."""

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.main import create_album, create_revision
from app.schemas.music import AlbumCreate, RatingRevisionCreate

ROOT = Path(__file__).resolve().parents[2]


def run_backup(*args):
    return subprocess.run(
        [sys.executable, str(ROOT / "scripts/backup.py"), *map(str, args)],
        capture_output=True,
        text=True,
    )


def test_migrate_backup_restore_preserves_snapshots_and_media(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    database = source / "aftertone.sqlite3"
    media = source / "covers"
    media.mkdir()
    env = {
        **os.environ,
        "AFTERTONE_ENV": "development",
        "AFTERTONE_DATABASE_URL": f"sqlite:///{database}",
    }
    migration = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=ROOT / "backend",
        env=env,
        capture_output=True,
        text=True,
    )
    assert migration.returncode == 0, migration.stderr
    synthetic = create_engine(f"sqlite:///{database}")
    try:
        with Session(synthetic) as session:
            album = create_album(
                AlbumCreate(
                    title="Synthetic restore album",
                    artists=[{"name": "Synthetic restore artist"}],
                    tracks=[{"position": 1, "title": "Synthetic track"}],
                ),
                session,
            )
            revision = create_revision(
                album.id,
                RatingRevisionCreate(
                    coherence="7",
                    emotion="8",
                    album_notes="Synthetic private note",
                    tracks=[{"track_id": album.tracks[0].id, "score": "9"}],
                ),
                session,
            )
        cover = "a" * 32 + ".webp"
        portrait = "b" * 32 + ".webp"
        (media / cover).write_bytes(b"synthetic cover content")
        (media / portrait).write_bytes(b"synthetic portrait content")
        with sqlite3.connect(database) as db:
            db.execute("UPDATE albums SET cover_filename=?", (cover,))
            db.execute("UPDATE artists SET image_filename=?", (portrait,))
            db.execute(
                "INSERT INTO owner_sessions VALUES (?, ?, ?)", ("a" * 64, 9999999999, "b" * 64)
            )
        archive = tmp_path / "snapshot.tar.gz"
        created = run_backup(
            "create", "--database", database, "--media", media, "--destination", archive
        )
        assert created.returncode == 0, created.stderr
        restored = tmp_path / "restored"
        recovered = run_backup("restore", "--archive", archive, "--destination", restored)
        assert recovered.returncode == 0, recovered.stderr
        with sqlite3.connect(restored / "aftertone.sqlite3") as db:
            assert db.execute("PRAGMA integrity_check").fetchone() == ("ok",)
            assert not db.execute("PRAGMA foreign_key_check").fetchall()
            assert db.execute(
                "SELECT final_rating, album_notes FROM rating_revisions"
            ).fetchone() == (float(revision.final_rating), "Synthetic private note")
            assert db.execute("SELECT name FROM artists").fetchone() == (
                "Synthetic restore artist",
            )
            assert db.execute("SELECT COUNT(*) FROM owner_sessions").fetchone() == (0,)
            assert db.execute("SELECT version_num FROM alembic_version").fetchone() == ("0017",)
        assert (restored / "covers" / cover).read_bytes() == (media / cover).read_bytes()
        assert (restored / "covers" / portrait).read_bytes() == (media / portrait).read_bytes()
        assert archive.stat().st_mode & 0o777 == 0o600
        # Both create and restore refuse to overwrite an existing destination.
        assert (
            run_backup("restore", "--archive", archive, "--destination", restored).returncode != 0
        )
        assert (
            run_backup(
                "create", "--database", database, "--media", media, "--destination", archive
            ).returncode
            != 0
        )
        (media / cover).unlink()
        assert (
            run_backup(
                "create",
                "--database",
                database,
                "--media",
                media,
                "--destination",
                tmp_path / "incomplete.tar.gz",
            ).returncode
            != 0
        )
    finally:
        synthetic.dispose()
