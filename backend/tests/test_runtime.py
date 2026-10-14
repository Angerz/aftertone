"""Container startup safeguards without importing or accessing the owner's database."""

import importlib.util
import os
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "container_runtime", Path(__file__).resolve().parents[2] / "deploy/runtime.py"
)
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    for name in [
        "RAILWAY_SERVICE_ID",
        "RAILWAY_VOLUME_MOUNT_PATH",
        "AFTERTONE_ALLOW_EMPTY_DATABASE",
        "AFTERTONE_INIT_VOLUME",
        "AFTERTONE_MAINTENANCE",
    ]:
        monkeypatch.delenv(name, raising=False)


def test_railway_requires_real_expected_mount(monkeypatch, tmp_path):
    monkeypatch.setenv("RAILWAY_SERVICE_ID", "synthetic-service")
    monkeypatch.setenv("RAILWAY_VOLUME_MOUNT_PATH", "/data")
    monkeypatch.setattr(runtime, "VOLUME", tmp_path)
    with pytest.raises(RuntimeError, match="persistent volume"):
        runtime.verify_mount()


def test_root_requires_explicit_initialization(monkeypatch):
    monkeypatch.setattr(runtime.os, "geteuid", lambda: 0)
    with pytest.raises(RuntimeError, match="Root startup"):
        runtime.prepare_identity()


def test_privilege_drop_precedes_application_execution(monkeypatch):
    calls = []
    identity = [0]
    monkeypatch.setenv("AFTERTONE_INIT_VOLUME", "1")
    monkeypatch.setattr(runtime.os, "geteuid", lambda: identity[0])
    monkeypatch.setattr(runtime, "initialize_ownership", lambda: calls.append("initialize"))
    monkeypatch.setattr(runtime.os, "setgroups", lambda groups: calls.append(("groups", groups)))
    monkeypatch.setattr(runtime.os, "setgid", lambda gid: calls.append(("gid", gid)))

    def setuid(uid):
        calls.append(("uid", uid))
        identity[0] = uid

    monkeypatch.setattr(runtime.os, "setuid", setuid)
    runtime.prepare_identity()
    assert calls == ["initialize", ("groups", []), ("gid", 10001), ("uid", 10001)]


def test_missing_database_needs_explicit_first_boot(monkeypatch, tmp_path):
    monkeypatch.setenv("RAILWAY_SERVICE_ID", "synthetic-service")
    monkeypatch.setenv("AFTERTONE_DATABASE_URL", f"sqlite:///{tmp_path}/journal.sqlite3")
    monkeypatch.setenv("AFTERTONE_COVER_DIR", str(tmp_path / "covers"))
    with pytest.raises(RuntimeError, match="database missing"):
        runtime.verify_storage(maintenance=False)
    assert not (tmp_path / "journal.sqlite3").exists()
    runtime.verify_storage(maintenance=True)
    monkeypatch.setenv("AFTERTONE_ALLOW_EMPTY_DATABASE", "1")
    runtime.verify_storage(maintenance=False)


def test_reject_volume_paths_that_escape_or_follow_symlinks(monkeypatch, tmp_path):
    volume = tmp_path / "volume"
    volume.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (volume / "link").symlink_to(outside, target_is_directory=True)
    monkeypatch.setattr(runtime, "VOLUME", volume)
    for path in [
        outside / "journal.sqlite3",
        volume / "link" / "journal.sqlite3",
        volume / ".." / "outside",
    ]:
        with pytest.raises(RuntimeError, match="inside /data"):
            runtime.verify_volume_path(path)


def test_ownership_repair_rejects_links(monkeypatch, tmp_path):
    outside = tmp_path / "outside"
    outside.write_text("unchanged")
    volume = tmp_path / "volume"
    volume.mkdir()
    (volume / "bad").symlink_to(outside)
    monkeypatch.setattr(runtime, "VOLUME", volume)
    monkeypatch.setattr(runtime, "verify_mount", lambda: None)
    with pytest.raises(RuntimeError, match="Unexpected link"):
        runtime.initialize_ownership()
    assert outside.read_text() == "unchanged"


def test_storage_lock_rejects_second_runtime(tmp_path):
    fd = runtime.acquire_writer_lock(tmp_path)
    try:
        with pytest.raises(RuntimeError, match="Another Aftertone"):
            runtime.acquire_writer_lock(tmp_path)
    finally:
        os.close(fd)


def test_failed_migration_never_executes_server(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(runtime, "prepare_identity", lambda: None)
    monkeypatch.setattr(runtime, "verify_storage", lambda **kwargs: tmp_path / "synthetic.sqlite3")
    monkeypatch.setattr(runtime, "acquire_writer_lock", lambda directory: -1)
    monkeypatch.setattr(runtime.sys, "argv", ["runtime.py"])
    monkeypatch.setattr("app.config.validate_configuration", lambda: None)

    def fail_migration(*args, **kwargs):
        raise runtime.subprocess.CalledProcessError(1, args[0])

    monkeypatch.setattr(runtime.subprocess, "run", fail_migration)
    monkeypatch.setattr(runtime.os, "execvp", lambda *args: calls.append(args))
    with pytest.raises(runtime.subprocess.CalledProcessError):
        runtime.main()
    assert calls == []
