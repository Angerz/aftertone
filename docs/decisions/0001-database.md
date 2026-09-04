# Database choice: SQLite

## Context

Aftertone is a personal, local, single-user application. It needs durable structured data and easy backups, not concurrent remote access.

## Options considered

- SQLite: one local file, no server administration, simple backup.
- PostgreSQL: stronger multi-user/concurrent-server features, but introduces a service, ports, and operations work.

## Decision

Use SQLite through SQLAlchemy 2.x. The database location is configured by `AFTERTONE_DATABASE_URL` and defaults to `backend/aftertone.sqlite3` when commands run from `backend/`.

## Consequences

There is no database container or port to manage. Alembic remains the schema authority, making a future migration to PostgreSQL possible if a real need arises. Scores use SQL `NUMERIC`; SQLite's type affinity is sufficient for this local use while domain calculations retain `Decimal` precision in Python.

