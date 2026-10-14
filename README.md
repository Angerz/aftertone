# Aftertone

Aftertone is my local music journal: a private place for my listening history, my thoughts, and my love of music. I use it to keep albums, per-track scores, and notes without overwriting what I felt at a particular moment. It includes a visual album library, structured artists and credits, legacy Excel import and reconciliation, and Album Momentum.

It supports local use and a controlled public deployment: visitors can browse music metadata and numeric ratings, while only the owner can edit. Written journal notes and revisit details remain private. See [production deployment](docs/production/deployment.md) before exposing it to the internet.

## Features

- Visual album library with pagination, search, sorting, and year/decade filters.
- Local cover art uploads and import from image URLs.
- Per-track scores and notes with canonical album-rating calculation.
- Immutable rating history and Rate Again from the latest revision.
- Revisit markers for albums worth returning to.
- Canonical artists, multi-artist albums, featured track credits, portraits, and optional person/group metadata.
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

With the included Makefile, prepare dependencies once. Generate an owner password hash with `cd backend && .venv/bin/python -m app.auth`, store it single-quoted as `AFTERTONE_OWNER_PASSWORD_HASH` in `.env`, and then start both processes together:

```bash
make setup
make dev
```

`make dev` applies pending migrations, starts the API and Vite, and stops both when you press Ctrl+C. For an already configured checkout, `make dev` is the only command needed to start the app. Run `make help` for the remaining commands.

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

The Vite server is loopback-bound and proxies `/api` and `/media` to the backend. The frontend uses same-origin requests. CORS permits the configured web origin; owner sessions and CSRF checks independently protect writes. Sign in with the owner control. Without a configured hash the application is read-only.

Album covers are stored in `AFTERTONE_COVER_DIR` (by default `backend/data/covers`). Both album covers and artist portraits use this directory. A complete backup includes the SQLite database, all media, and snapshot metadata.

## Complete backups

Stop application writers and run `make backup`. The script creates a consistent SQLite
copy plus covers, artist portraits and a checksummed manifest. Keep an encrypted copy
outside the application host and regularly test restoration. See
[backup and restore](docs/production/backup-restore.md) for local/container commands,
scheduling, retention and non-destructive recovery.

## Production preparation

The multi-stage `Dockerfile` serves frontend and API together as a non-root user;
`compose.yaml` provides persistent storage and a loopback-only application port.
Production requires an owner Argon2id hash, an HTTPS origin and persistent absolute paths.
Use `.env.production.example` as a template. No deployment is performed automatically.
Read the [security audit](docs/production/security-audit.md),
[deployment guide](docs/production/deployment.md) and
[release checklist](docs/production/release-checklist.md).

## Tests

For release confidence:

```bash
cd backend
pytest
ruff check .
ruff format --check .

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

### Favorite Songs

Favorite Songs is a separate, fully personal ranking of individual catalogue tracks. Add songs manually by selecting an existing track, then recording your assessment; it does not create or alter album-rating revisions.

The ranking has two views:

- **Top 100** shows only positions 1–100.
- **Candidates** shows every ranked song after position 100, so a song can remain part of the journal without being in the Top 100.

Each ranking row can be expanded independently to inspect its stored score breakdown and personal notes. Opening one song never closes another; Edit and Remove remain separate actions.

Favorite Songs use a separate, completely subjective formula:

```text
final score = Puntuación × 25%
            + Conexión emocional × 55%
            + Replay value × 15%
            + Originalidad × 5%
```

`Puntuación` measures the song as an isolated work, while the other criteria record the listener's personal response. `Originalidad` specifically means how singular the song feels based on the listener's own experience, not an objective claim of historical innovation. Historical relevance is not part of the Favorite Songs formula.

Songs are ordered first by final score. Exact score ties are deterministic: emotional connection, replay value, base score, originality, then track title.

Interactive API documentation is available at `/docs` in development and disabled in production. The full [API access inventory](docs/production/api-inventory.md) identifies public and owner-only routes.

### Albums

- `GET /api/albums` for list/search/pagination/filtering and `GET /api/albums/facets` for year navigation.
- `POST /api/albums`, `GET /api/albums/{id}`, and `PATCH /api/albums/{id}` for catalogue metadata.
- Rating revisions, revisit markers, and local cover upload/import endpoints under album routes.

### Artists

- Artist list, creation, detail, and metadata update endpoints.
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

- There is one owner and no registration or sync. All catalogue metadata and numeric history are public when deployed; there is no per-entry publication control.
- There is no browser E2E suite yet.
- Legacy multi-artist strings are not automatically split into separate artists.
- Some history/ranking reads scale with the complete personal catalogue; monitor before broader traffic.
- The current TestClient emits an HTTPX integration deprecation warning; runtime behavior is unaffected.
