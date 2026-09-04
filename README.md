# Aftertone

Aftertone is a local, single-user journal for rating music releases. It preserves per-track scores and notes alongside revisitable album evaluations, rather than overwriting old opinions.

## Requirements

- Python 3.13+
- Node.js 20+

No database service or Docker installation is required in this iteration. SQLite is a local file managed through Alembic.

## Start from a clone

Copy the sample environment file and adjust loopback ports only if they conflict with another local application:

```bash
cp .env.example .env
```

Create and activate a virtual environment, install the API and test dependencies, then migrate and run it:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
set -a; source ../.env; set +a
alembic upgrade head
uvicorn app.main:app --host "$AFTERTONE_API_HOST" --port "$AFTERTONE_API_PORT" --reload
```

The health check is available at `http://127.0.0.1:8017/health` with the sample configuration.

In another terminal, start the frontend:

```bash
cd frontend
npm install
set -a; source ../.env; set +a
npm run dev -- --port "$AFTERTONE_WEB_PORT"
```

The Vite server is explicitly loopback-bound in `vite.config.ts`.
The API permits requests only from `AFTERTONE_WEB_ORIGIN` (the sample value is the
local Vite URL), rather than accepting arbitrary browser origins.

## Migrations and tests

From `backend/`, with the virtual environment active and environment loaded:

```bash
alembic upgrade head
pytest tests/ratings/test_calculator.py
```

Use focused tests for the code changed; reserve the full suite (`pytest`) for cross-cutting work or a release. For frontend type checking, run `npm run lint`; use `npm run build` when build-level confidence is useful.
Run the focused frontend rating-preview parity suite from `frontend/` with `npm test`.

## Layout

```text
backend/                  FastAPI API, domain logic, models, migrations, tests
frontend/                 React + TypeScript + Vite shell
docs/decisions/           short architectural decision records
AGENTS.md                 project instructions for coding agents
.env.example              loopback ports and SQLite URL
```

## Current API

FastAPI exposes interactive OpenAPI documentation at `/docs`. The current vertical slice provides:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/albums` | Create an album and its complete track list. |
| `GET` | `/api/albums` | List albums. |
| `GET` | `/api/albums/{album_id}` | Read album metadata and tracks. |
| `POST` | `/api/albums/{album_id}/revisions` | Create a complete calculated rating snapshot. |
| `GET` | `/api/albums/{album_id}/revisions` | List revision summaries. |
| `GET` | `/api/albums/{album_id}/revisions/{revision_id}` | Read a complete historical snapshot. |

Every revision must contain one rating entry for each current album track. The server obtains all derived values from the central rating calculator; clients never provide them.

## Key decisions

- SQLite, selected for a zero-administration local application.
- Direct Python/Node development processes; Docker has no current benefit.
- SQLAlchemy 2.x plus Alembic for explicit, durable persistence evolution.
- Immutable rating snapshots, including per-track score/note/inclusion data.
- `Decimal` domain calculations and `NUMERIC` score columns.

See `docs/decisions/` for the rationale.
