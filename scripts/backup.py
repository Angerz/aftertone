"""Portable complete snapshots. Stop application writers during create/restore."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sqlite3
import tarfile
import tempfile
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

MEDIA_NAME = re.compile(r"[0-9a-f]{32}\.webp\Z")


def checksum(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def check_database(path: Path) -> None:
    with closing(sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)) as db:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Database integrity check failed.")
        if db.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError(
                "Database has foreign-key violations; repair explicitly before proceeding."
            )


def create(database: Path, media: Path, destination: Path) -> None:
    if not database.is_file() or not media.is_dir():
        raise ValueError("Existing database and media directory are required.")
    if destination.exists():
        raise ValueError("Backup destination already exists.")
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(dir=destination.parent) as directory:
        stage = Path(directory)
        copy = stage / "aftertone.sqlite3"
        with (
            closing(
                sqlite3.connect(f"{database.resolve().as_uri()}?mode=ro", uri=True)
            ) as source,
            closing(sqlite3.connect(copy)) as target,
        ):
            source.backup(target)
        check_database(copy)
        covers = stage / "covers"
        covers.mkdir()
        for image in media.iterdir():
            if image.name.startswith("."):
                continue
            if (
                not MEDIA_NAME.fullmatch(image.name)
                or image.is_symlink()
                or not image.is_file()
            ):
                raise ValueError(
                    "Unexpected media file; inspect storage before backup."
                )
            shutil.copyfile(image, covers / image.name)
        with closing(sqlite3.connect(copy)) as db:
            for table, column in [
                ("albums", "cover_filename"),
                ("artists", "image_filename"),
            ]:
                for (filename,) in db.execute(
                    f"SELECT {column} FROM {table} WHERE {column} IS NOT NULL"
                ):
                    if (
                        not MEDIA_NAME.fullmatch(filename)
                        or not (covers / filename).is_file()
                    ):
                        raise ValueError(
                            "A referenced image is missing; backup aborted."
                        )
            version = db.execute("SELECT version_num FROM alembic_version").fetchone()[
                0
            ]
            # Backups must not preserve active sessions or lockout state.
            tables = {
                row[0]
                for row in db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            for table in ["owner_sessions", "login_throttle"]:
                if table in tables:
                    db.execute(f"DELETE FROM {table}")
            db.commit()
        files = [copy, *sorted(covers.iterdir())]
        manifest = {
            "format": 1,
            "created_at": datetime.now(UTC).isoformat(),
            "alembic_revision": version,
            "files": {str(file.relative_to(stage)): checksum(file) for file in files},
        }
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        archive_path = stage / "snapshot.tar.gz"
        with tarfile.open(archive_path, "w:gz") as archive:
            for file in [stage / "manifest.json", *files]:
                archive.add(file, arcname=str(file.relative_to(stage)), recursive=False)
        archive_path.chmod(0o600)
        # Hard link is atomic and fails if destination appeared concurrently.
        os.link(archive_path, destination)


def restore(archive_path: Path, destination: Path) -> None:
    if destination.exists():
        raise ValueError(
            "Restore destination must not exist. Restore alongside current data."
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as directory:
        stage = Path(directory) / "restored"
        stage.mkdir(mode=0o700)
        with tarfile.open(archive_path, "r:gz") as archive:
            members = archive.getmembers()
            if (
                len(members) > 100_000
                or sum(item.size for item in members) > 10 * 1024**3
            ):
                raise ValueError("Archive exceeds restore limits.")
            manifest_member = archive.getmember("manifest.json")
            if manifest_member.size > 16 * 1024**2 or not manifest_member.isfile():
                raise ValueError("Invalid backup manifest.")
            with archive.extractfile(manifest_member) as stream:
                manifest = json.load(stream)
            if manifest.get("format") != 1:
                raise ValueError("Unsupported backup format.")
            expected = manifest["files"]
            names = [item.name for item in members]
            if len(names) != len(set(names)) or set(names) != {
                "manifest.json",
                *expected,
            }:
                raise ValueError("Unexpected or duplicate archive members.")
            for name, expected_hash in expected.items():
                if name != "aftertone.sqlite3" and not (
                    name.startswith("covers/")
                    and MEDIA_NAME.fullmatch(name.removeprefix("covers/"))
                ):
                    raise ValueError("Unsafe backup path.")
                member = archive.getmember(name)
                if not member.isfile():
                    raise ValueError("Backup may contain only regular files.")
                target = stage / name
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with archive.extractfile(member) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o600)
                if checksum(target) != expected_hash:
                    raise ValueError("Backup checksum mismatch.")
        (stage / "covers").mkdir(exist_ok=True, mode=0o700)
        check_database(stage / "aftertone.sqlite3")
        stage.rename(destination)


def main() -> None:
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    backup = sub.add_parser("create")
    backup.add_argument("--database", type=Path, required=True)
    backup.add_argument("--media", type=Path, required=True)
    backup.add_argument("--destination", type=Path, required=True)
    recovery = sub.add_parser("restore")
    recovery.add_argument("--archive", type=Path, required=True)
    recovery.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "create":
        create(args.database, args.media, args.destination)
    else:
        restore(args.archive, args.destination)
    print("Snapshot operation completed.")


if __name__ == "__main__":
    main()
