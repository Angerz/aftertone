# Aftertone

Aftertone is a local, single-user music-rating journal. It preserves albums, per-track scores and notes, and immutable rating revisions rather than overwriting past opinions. It includes a visual album library, structured artists and credits, legacy Excel import and reconciliation, and Album Momentum.

## Features

- Visual album library with pagination, search, sorting, and year/decade filters.
- Local cover art uploads and import from image URLs.
- Per-track scores and notes with canonical album-rating calculation.
- Immutable rating history and Rate Again from the latest revision.
- Revisit markers for albums worth returning to.
- Canonical artists, multi-artist albums, and featured track credits.
- Legacy Excel preview/import and explicit tracklist reconciliation.
- Album Momentum for viewing an album's track-score trajectory.

## Requirements

- Python 3.13+
- Node.js 20+

No database service or Docker installation is required. SQLite is a local file managed through Alembic.

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

> The default SQLite URL is relative to the backend working directory. Run Alembic and Uvicorn from `backend/` as shown above; running them from another working directory may create or use a different SQLite file.

The health check is available at `http://127.0.0.1:8017/health` with the sample configuration.

In another terminal, start the frontend:

```bash
cd frontend
npm install
set -a; source ../.env; set +a
npm run dev -- --port "$AFTERTONE_WEB_PORT"
```

The Vite server is explicitly loopback-bound in `vite.config.ts`. The API permits requests only from `AFTERTONE_WEB_ORIGIN` (the sample value is the local Vite URL).

Album covers are stored in `AFTERTONE_COVER_DIR` (by default `backend/data/covers`). A complete backup consists of the SQLite database and that cover directory.

## Tests

For release confidence:

```bash
cd backend
pytest

cd ../frontend
npm run lint
npm test -- --run
npm run build
```

For day-to-day development, prefer focused tests such as `pytest tests/ratings/test_calculator.py` or `npm test` for the relevant frontend feature. Run Alembic migrations from `backend/` with `alembic upgrade head`.

## Layout

```text
backend/          FastAPI API, SQLAlchemy models, Alembic migrations, and domain logic
frontend/         React and TypeScript client
docs/decisions/   concise architectural decisions
AGENTS.md         project conventions
.env.example      loopback ports, SQLite URL, and cover directory
```

## API

Full interactive API documentation is available at `/docs` while the backend is running.

### Albums

- `GET /api/albums` for list/search/pagination/filtering and `GET /api/albums/facets` for year navigation.
- `POST /api/albums`, `GET /api/albums/{id}`, and `PATCH /api/albums/{id}` for catalogue metadata.
- Rating revisions, revisit markers, and local cover upload/import endpoints under album routes.

### Artists

- Artist list, creation, and detail endpoints.
- Structured ordered album artists and primary/featured track credits.

### Legacy

- Excel import preview and commit endpoints.
- Legacy rating detail, reconciliation preview, and reconciliation endpoints.

## Key decisions

- SQLite is used for durable, zero-administration local storage; Alembic is the schema authority.
- Rating formulas live in the backend calculator, use `Decimal`, and revisions are immutable snapshots.
- Artists are first-class entities with structured, ordered album and track credits.
- Legacy ratings remain separate from native revisions until explicit reconciliation.
- Covers uploaded or imported from URLs are stored locally; only media URLs are exposed by the API.
- `Unrated` is distinct from a score of `0` in historical track snapshots.

See `docs/decisions/` for the full rationale.

## Known limitations

- Aftertone is a local, single-user application with no authentication or sync.
- There is no browser E2E suite yet.
- Legacy multi-artist strings are not automatically split into separate artists.
- The backend currently emits Pydantic deprecation warnings that should be resolved before Pydantic v3.
