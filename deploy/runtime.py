"""Container startup: guarded Railway volume preparation, then unprivileged execution."""

from __future__ import annotations

import fcntl
import json
import os
import stat
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

APP_UID = APP_GID = 10001
VOLUME = Path("/data")


def railway_storage() -> bool:
    return bool(os.getenv("RAILWAY_SERVICE_ID") or os.getenv("RAILWAY_VOLUME_MOUNT_PATH"))


def verify_mount() -> None:
    if os.getenv("RAILWAY_VOLUME_MOUNT_PATH") != str(VOLUME) or not VOLUME.is_mount():
        raise RuntimeError(
            "Railway requires its persistent volume mounted at /data; refusing ephemeral storage."
        )


def storage_paths() -> tuple[Path, Path]:
    url = os.getenv("AFTERTONE_DATABASE_URL", "sqlite:////data/aftertone.sqlite3")
    if not url.startswith("sqlite:////"):
        raise RuntimeError("The container requires an absolute SQLite database path.")
    return Path(url.removeprefix("sqlite:///")), Path(
        os.getenv("AFTERTONE_COVER_DIR", "/data/covers")
    )


def verify_volume_path(path: Path) -> None:
    if not path.is_absolute() or not path.is_relative_to(VOLUME) or path.resolve() != path:
        raise RuntimeError(
            "Railway database/media paths must be inside /data without symlinks or traversal."
        )


def initialize_ownership() -> None:
    """Only the dedicated mounted volume is writable during privileged initialization.

    fwalk + directory-relative, no-follow opens avoid following uploaded symlinks.
    Filesystem-created lost+found is deliberately left to the volume administrator.
    """
    verify_mount()
    device = VOLUME.stat().st_dev
    for root, directories, files, directory_fd in os.fwalk(VOLUME, follow_symlinks=False):
        if Path(root) == VOLUME:
            directories[:] = [name for name in directories if name != "lost+found"]
        for name in [*directories, *files]:
            info = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
            if info.st_dev != device or not (
                stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)
            ):
                raise RuntimeError(
                    "Unexpected link, mount or special file in /data; inspect the volume."
                )
            if stat.S_ISREG(info.st_mode) and info.st_nlink != 1:
                raise RuntimeError("Hard-linked volume files require manual review.")
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory_fd)
            try:
                opened = os.fstat(fd)
                if (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
                    raise RuntimeError("Volume changed during ownership initialization.")
                if (opened.st_uid, opened.st_gid) != (APP_UID, APP_GID):
                    os.fchown(fd, APP_UID, APP_GID)
                os.fchmod(fd, 0o700 if stat.S_ISDIR(opened.st_mode) else 0o600)
            finally:
                os.close(fd)
        os.fchown(directory_fd, APP_UID, APP_GID)
        os.fchmod(directory_fd, 0o700)


def prepare_identity() -> None:
    if railway_storage():
        verify_mount()
        for path in storage_paths():
            verify_volume_path(path)
    if os.geteuid() == 0:
        if os.getenv("AFTERTONE_INIT_VOLUME") != "1":
            raise RuntimeError(
                "Root startup is forbidden without explicit AFTERTONE_INIT_VOLUME=1."
            )
        initialize_ownership()
        os.setgroups([])
        os.setgid(APP_GID)
        os.setuid(APP_UID)
    if os.geteuid() == 0:
        raise RuntimeError("Privilege drop failed; refusing to start.")
    print(
        json.dumps({"event": "runtime_identity", "uid": os.geteuid(), "gid": os.getegid()}),
        flush=True,
    )


def verify_storage(*, maintenance: bool) -> Path:
    database, media = storage_paths()
    if (
        railway_storage()
        and not maintenance
        and not database.is_file()
        and os.getenv("AFTERTONE_ALLOW_EMPTY_DATABASE") != "1"
    ):
        raise RuntimeError(
            "SQLite database missing. Restore it, or explicitly allow first initialization with AFTERTONE_ALLOW_EMPTY_DATABASE=1."
        )
    database.parent.mkdir(parents=True, exist_ok=True)
    media.mkdir(parents=True, exist_ok=True)
    for directory in {database.parent, media}:
        # Actually exercise create/write/unlink as the application UID.
        with tempfile.TemporaryFile(dir=directory) as probe:
            probe.write(b"storage preflight")
            probe.flush()
    return database


def acquire_writer_lock(directory: Path) -> int:
    fd = os.open(
        directory / ".aftertone-runtime.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600
    )
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(fd)
        raise RuntimeError("Another Aftertone runtime already owns this storage.") from None
    # The lock remains held across exec into the single Uvicorn process.
    os.set_inheritable(fd, True)
    return fd


class MaintenanceHandler(BaseHTTPRequestHandler):
    def respond(self) -> None:
        ready = self.command == "GET" and self.path == "/health"
        payload = (
            b'{"status":"maintenance"}'
            if ready
            else b'{"detail":"Aftertone is temporarily unavailable for maintenance."}'
        )
        self.send_response(200 if ready else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if not ready:
            self.send_header("Retry-After", "300")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)
        self.close_connection = True

    do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = respond

    def log_message(self, *_args) -> None:
        pass


def main() -> None:
    os.umask(0o077)
    prepare_identity()
    # Owner-invoked SSH tooling: drop privileges but do not start another server/migrator.
    if len(sys.argv) > 1:
        os.execvp(sys.argv[1], sys.argv[1:])
    maintenance = os.getenv("AFTERTONE_MAINTENANCE", "0")
    if maintenance not in {"0", "1"}:
        raise RuntimeError("AFTERTONE_MAINTENANCE must be 0 or 1.")
    database = verify_storage(maintenance=maintenance == "1")
    lock_fd = acquire_writer_lock(VOLUME if railway_storage() else database.parent)
    if maintenance == "1":
        print(json.dumps({"event": "maintenance", "migrations": "skipped"}), flush=True)
        with HTTPServer(("0.0.0.0", int(os.getenv("PORT", "8017"))), MaintenanceHandler) as server:
            server.serve_forever()
        os.close(lock_fd)
        return
    from app.config import validate_configuration

    validate_configuration()
    subprocess.run(["alembic", "upgrade", "head"], check=True)
    os.execvp(
        "uvicorn",
        [
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            os.getenv("PORT", "8017"),
            "--workers",
            "1",
            "--limit-concurrency",
            "32",
            "--timeout-keep-alive",
            "5",
            "--no-access-log",
            "--forwarded-allow-ips",
            os.getenv("AFTERTONE_PROXY_IPS", "127.0.0.1"),
        ],
    )


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Aftertone startup failed: {error}") from None
