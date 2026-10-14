# Complete backup and restoration

A complete snapshot contains a SQLite online-backup copy, every generated cover and
artist portrait, and a JSON manifest with schema revision, UTC timestamp and SHA-256
checksums. Sessions and login lockout rows are removed from the backup copy. Original
data is untouched. The application configuration/password hash must be retained
separately in a password manager or encrypted configuration store; it is not archived.

Stop application writers during backup so the database and filesystem describe the
same moment. SQLite's backup API makes a consistent database copy, but it cannot
coordinate an image replacement/delete happening in another process. The tool verifies
all referenced images exist and aborts on missing media or failed integrity checks.

## Local backup

Stop `make dev` first, then run `make backup` or `scripts/backup_aftertone.sh`. The
wrapper reads `.env` if present and honors database/media paths and optional
`AFTERTONE_BACKUP_DIR`. By default archives go to `backend/data/backups`, which is
useful locally but insufficient for disaster recovery. Files use 0600 and directories
0700; originals and existing destinations are never overwritten.

## VPS/container backup

`/backups` is a bind mount on the host, independent of the application image/container.
Pre-create its host directory with UID/GID 10001 and mode 0700. Set the environment
file and use a unique archive name. Stop the app, bypass its normal migration/start
entrypoint, and make the snapshot:

```sh
docker compose --env-file .env.production stop app
docker compose --env-file .env.production run --rm --no-deps --entrypoint python app \
  /app/scripts/backup.py create \
  --database /data/aftertone.sqlite3 --media /data/covers \
  --destination /backups/aftertone-2026-10-14T030000Z.tar.gz
docker compose --env-file .env.production start app
```

Use a new UTC timestamp each time. For scheduling, wrap these commands in a host script
with `set -eu`, an exclusive `flock`, and an EXIT trap that restarts the app even if
backup fails. Send failures to an operator-visible log/alert. Do not install an
unreviewed cron entry that silently accumulates failed or incomplete backups.

Copy the resulting archive to a separate host or object store, over authenticated,
encrypted transport. For example, after configuring your own SSH backup account:

```sh
rsync --chmod=F600,D700 backups/aftertone-2026-10-14T030000Z.tar.gz \
  backup-user@YOUR-BACKUP-HOST:aftertone/
```

Replace the destination; none is configured automatically. Encrypt private archives
at rest with your chosen backup tool, and retain its recovery keys separately. Verify
the remote copy and periodically download/restore it. An archive only in `/data`, in
the application container, or on the same VPS is not an external backup.

Start with daily snapshots, 7 daily and 4 weekly retained copies, and a restore drill
after every schema change. Adjust retention and acceptable data loss explicitly; no
automatic deletion is implemented. Off-host jobs and retention must be configured
before public release. Keep a pre-upgrade archive until the new release is verified.

## Restore alongside current data

Use Python 3.13 and the repository's stdlib-only script; the destination must not exist:

```sh
python3 scripts/backup.py restore \
  --archive /path/to/downloaded-snapshot.tar.gz \
  --destination /path/to/new-aftertone-data
```

The tool verifies manifest membership, regular-file types, allowed paths, checksums,
SQLite integrity and foreign keys before publishing the restored directory. It refuses
existing destinations. An empty media directory is recreated. Never extract a backup
with an unrestricted `tar` command into a live application directory.

For a container restore, restore into a new host directory, give UID/GID 10001 ownership
and mount that directory at `/data` in a private test deployment. Set the same app
release/configuration and use no public port. Confirm `/health`, album/track/artist
relationships, exact historical scores/notes, covers, portraits, anonymous redaction
and owner login. Only after the drill succeeds and public deployment is approved should
you stop the original app and switch its volume binding. Retain the original volume
until the new one is verified. Startup runs only forward Alembic upgrades.

The automated `tests/test_backup_restore.py` migrates an empty synthetic database,
creates artist/album/track/revision data, stores both media types, archives/restores,
checks exact stored scores and private notes, verifies sessions were excluded, checks
SQLite integrity/foreign keys, and confirms overwrite and missing-media refusal.
No personal database is used. This verifies the recovery mechanism; the operator must
still prove retrieval from their chosen external destination.
