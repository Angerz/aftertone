# Aftertone

Aftertone is a personal musical journal: a place to keep the albums you listen to, the songs that stay with you, and what you thought and felt along the way. It preserves track scores, written notes and listening-session revisions without overwriting a previous experience just because your opinion has changed.

The numbers are personal, not an objective measure of musical worth. Aftertone is not a streaming service, a social network or a recommendation engine. Its purpose is to help one listener build a lasting record of their relationship with music.

The interface follows a warm editorial style: ivory backgrounds, serif headings, terracotta accents and compact catalogue lists. It works locally, with an optional public, read-only view of the catalogue and numeric ratings. There is one owner; written journal notes and revisit details remain private.

## What you can do

### Library and album journal

- Browse a cover-led Library with server-side pagination and search by album or artist.
- Filter by year, decade or unrated status; the owner can also filter albums marked for a revisit.
- Sort by Rating, Date rated, Release year, Artist or Title, independently ascending or descending. Unrated albums remain last for rating/date sorting in both directions.
- Keep search, filters, sorting and pagination in the URL, so refresh and contextual return navigation preserve the browsing state where available.
- Record a release year alone or an optional exact release date. An exact date synchronizes the year; clearing the date preserves the year. No month or day is invented for year-only records.
- Follow the year from Album Detail to the corresponding Library filter. With an exact date, the month is a separate link to that month and year; month-specific results exclude year-only records.
- Maintain ordered album artists, structured primary/featured track credits and multi-disc tracklists.
- Store cover art locally, from an upload or a supported image URL.

Supported project types are Album, Soundtrack, Single, EP, Mixtape, Compilation, Live, Reissue and Unknown/Other projects.

Album Detail brings together the latest rating, parameter contributions, track scores, notes and revision history. `Rate album` / `Rate again` is the primary owner action; metadata editing lives in the compact actions menu. Editing metadata does not rewrite completed rating snapshots.

### Listening sessions and rating history

The Album Rating Editor records individual track scores, track notes, coherence, emotion and album-level notes. Each successful save creates a new, immutable rating revision. You can start a new session from the latest revision without changing the old one.

- Included tracks need a valid score from 0 to 10. A score of `0` is valid; a missing score is not zero.
- Tracks excluded from PRE collapse to compact rows. Hiding their fields preserves any score and notes, both in form state and in the saved payload.
- Required-track validation appears after interaction or an attempted save, rather than on untouched fields at initial load.
- A provisional summary accompanies the editor; the backend recalculates the authoritative result when saving.
- Local drafts autosave in the browser. A recovery dialog offers `Resume draft` or `Discard draft`, with the last local save time. Recovery must be resolved before autosave can overwrite that draft; Escape or backdrop interaction does not discard it.
- Failed saves leave the editor and its data available for retry. Browser storage availability still matters: local drafts are not a substitute for a database backup.

Album Momentum visualizes the track-score trajectory of a revision in disc/track order, with a PRE reference. Unrated tracks remain gaps, not fabricated zero scores. Historical revision views preserve their original track snapshots, scores and notes.

### Artists and their catalogue

Artists are canonical catalogue entities, not names inferred from song titles. The Artists Catalogue provides normalized search, server-side pagination and separate sorting field/direction controls:

- `Primary` is the default: artists with at least one primary project.
- `All artists` includes the whole artist catalogue.
- `Featuring only` includes artists with featured credits but no primary projects.
- Sorting supports Name, Average rating and Project count in both directions. Unrated artists remain last for average-rating sorting; deterministic name/ID tie-breakers keep pagination stable.

Artist names remain unchanged for display. Search and backend alphabetical sorting fold accents and common apostrophe variants, so names such as `Álvaro Díaz` sort with A. Nationality flags use existing country metadata; missing country information produces no flag.

Expandable artist rows show up to five primary projects, with rated projects first and chronological ordering within the rated/unrated sets. The limit is applied after ordering. Multiple artists can stay expanded independently, and `View artist →` opens the full detail page.

Artist Detail includes a portrait, optional person/group biography and country, the average of rated primary projects, completion squares and a project-type distribution. Featured appearances do not contribute to that average or primary project count. A valid rating of zero counts as rated. Tabs organize the content:

- **Projects:** grouped by release type, newest first. Within a year, known exact dates precede year-only projects; title/ID tie-breakers handle the remaining ties.
- **Top tracks:** up to ten highest-rated eligible tracks across the artist's catalogue, with compact covers, album/year metadata and numeric scores.
- **Featured appearances:** structured featured credits, kept separate from primary projects/tracks.

Tab selections participate in browser history: Back/Forward restores prior tabs before leaving the artist page. Editing is available through the owner actions menu.

### Top tracks and the full track catalogue

Artist track scores come only from each album's **latest native rating revision**, not an average of past sessions, an album final score or a Favorite Songs score. `0` is rated; `NULL` is unrated. Exclusion from PRE alone does not exclude a scored track.

Primary eligibility uses explicit track credits. If a track has no explicit primary credits, it inherits the album artists. Featuring-only appearances are not part of the primary Top tracks list.

Top tracks sorts by score descending, then album release chronology (including the year-only fallback), album title, disc number, track position and stable track ID.

`Explore all tracks →` opens `/artists/:id/tracks`, a dedicated catalogue with:

- Rated and unrated tracks, 20 per page.
- Search by track or album title.
- Rating, release-date, album and title sorting in both directions, applied before pagination. Unrated tracks remain last for rating sorting.
- Search/sort/direction/page URL state and contextual return navigation.
- Links to parent albums and sequence numbering across pages. These numbers describe the current results, not a permanent rank.

### Favorite Songs: a subjective Top 100

Favorite Songs is a separate personal ranking of catalogue tracks. Add entries manually through `+ Add song`, select an existing track in the anchored search popover, and record your assessment. This does not create or alter album-rating revisions. There is no Favorite Songs Excel synchronization/import pipeline.

The ranking has two views:

- **Top 100:** canonical positions 1–100, or fewer if the journal has fewer entries.
- **Candidates:** canonical positions 101 onward. These entries remain in the journal and can enter the Top 100 when scores change.

Each row expands independently to show the assessment and personal notes. `Edit` stays visible; removal is tucked into an overflow menu and still requires confirmation. After editing, the refreshed ranking returns to the same entry by ID, opens the correct view if membership changed, clears a hiding search and briefly highlights the song at its new position.

The formula is deliberately subjective:

| Criterion | Input scale | Weight after normalizing to 0–10 |
| --- | --- | --- |
| Song score / Puntuación | 0–10 | 25% |
| Emotional connection / Conexión emocional | 0–5 | 55% |
| Replay value | 0–5 | 15% |
| Originality / Originalidad | 0–5 | 5% |

Using the stored input scales, the backend formula is:

```text
final_score = 0.25 × base_score
            + 1.10 × emotional_connection
            + 0.30 × replay_value
            + 0.10 × originality
```

Song score assesses the song as an isolated work. The other criteria describe the listener's response. Originality means how singular the song feels within that listener's experience, not an objective claim of historical innovation. Historical relevance is not part of this formula.

Canonical positions use this order:

```text
final_score DESC,
emotional_connection DESC,
replay_value DESC,
base_score DESC,
originality DESC,
track title ASC
```

Two songs can display the same rounded final score while receiving different positions from these tie-breakers. Display sorting offers Position, Emotional connection, Replay value, Song score, Originality and Title. It changes only the order inside the selected view, never the canonical numbers or Top 100/Candidates membership. Display-sort ties use canonical position ascending; search also preserves those positions.

Top 100 movement indicators (`UP`, `DOWN`, `NEW`, `UNCHANGED`) persist across refreshes and reflect the most recent meaningful canonical ranking change. After 30 days they display as unchanged. This is a recent-movement feature, not a complete archive of every ranking version; display sorting/search does not create movement.

### Assisted metadata and legacy records

MusicBrainz integration is optional and owner-only. You can search and review a specific release before importing its local album record, tracklist and available cover, or use the existing album editor's assisted tracklist/cover tools. Reliable full dates can populate the optional release date; partial dates do not become invented exact dates. This is edition-aware metadata assistance, not an automatic listening-history sync.

Artist metadata lookup offers a field-by-field comparison. Select which values to apply to the form; the artist is not persisted until you save. Existing values are not silently overwritten. Routine journal browsing and manual entry do not require MusicBrainz.

The owner-only legacy album-rating importer remains available directly at `/import`, even though its link is no longer in the Library header. It previews supported `.xlsx` workbook rows, reports warnings/errors and imports selected records. It expects the historical album-rating format, not arbitrary spreadsheets or Favorite Songs workbooks: required headers include `ALBUM`, `ARTISTA`, `PRECALIFICACION`, `COHERENCIA` and `EMOCION`; optional metadata includes year, decade, genre and bad experience.

Legacy scores and source formula/audit metadata remain separate from native revisions. A conscious reconciliation maps extracted scores to a real tracklist before creating a native snapshot; import does not invent track identities or turn unmapped tracks into zero ratings. Library/artist effective album ratings use the latest native revision when present, otherwise the latest legacy computed rating, falling back to its stored legacy final rating.

## Owner access and public reading

The editorial landing page at `/` offers `Explore as guest` and `Owner sign in`. The catalogue is at `/library`. A shared header links Library, Artists and Top 100, with owner authentication controls; narrow screens use a compact navigation menu. Detail pages keep contextual Back navigation instead of duplicating the global links.

There is no registration, multi-user account system or shared journal editing. Owner authentication is required for writes **even in local development**.

If you expose Aftertone publicly, anonymous readers can see catalogue metadata, generated covers/portraits, structured credits, numeric ratings and revisions, Favorite Songs criteria, genres, positions and movement. Written notes, revisit information, legacy source/import details and administrative metadata are not published. Guests cannot edit, import or use owner-only metadata lookup endpoints.

**Public deployment is not a private vault for catalogue metadata or numeric listening history.** There is no per-entry publication toggle. Review the [public guest mode contract](docs/production/public-guest-mode.md) before exposing a journal. Local drafts stay in the owner's browser and are not deleted on logout; a shared browser profile is not a secure vault.

Owner access uses an environment-provisioned Argon2id password hash, server-side sessions, HttpOnly cookies and Origin/CSRF checks for writes. Production cookies require HTTPS. Logout revokes the current session; signing in replaces previous sessions. Changing the configured hash and restarting invalidates existing sessions. There is no default password.

## Run locally

### Requirements

- Python 3.13 or newer.
- Node.js 22.12 or newer recommended; the locked Vite version also supports Node 20.19+.
- npm and, for the one-command workflow, Make and Bash.

SQLite is a local file managed through Alembic. Local development does not require Docker or a database service.

### First-time setup

Run from the repository root:

```bash
make setup
```

This creates `.env` from [.env.example](.env.example) if absent, prepares `backend/.venv`, installs the backend development dependencies and installs frontend dependencies. It does not overwrite an existing `.env`.

Generate your owner password hash using that environment:

```bash
(cd backend && .venv/bin/python -m app.auth)
```

The command prompts twice for a password of at least 16 characters and prints its hash. Store the password securely and put the generated hash in the root `.env`:

```dotenv
# Replace the placeholder with the generated Argon2id hash, not your password.
AFTERTONE_OWNER_PASSWORD_HASH='<generated Argon2id hash>'
```

Keep the single quotes: Argon2 hashes contain dollar signs, and the Makefile sources `.env` as shell configuration. Never put passwords/hashes in `VITE_*` variables; those are public frontend build inputs. Do not commit `.env`.

Then start both processes:

```bash
make dev
```

`make dev` loads `.env`, applies pending migrations and runs Uvicorn plus Vite. Ctrl+C stops both. For an already configured checkout, this is the only startup command needed. Back up an existing journal before starting an upgraded checkout that contains migrations.

With the sample configuration:

- App: `http://127.0.0.1:5177`
- Owner sign-in: `http://127.0.0.1:5177/login`
- API health check: `http://127.0.0.1:8017/health`
- Development API documentation: `http://127.0.0.1:8017/docs`

Without a configured hash, development guest browsing remains available, but owner login reports `Owner login is not configured.` Production refuses to start without the required owner configuration.

### Configuration and storage

The local template defines:

| Variable | Default / purpose |
| --- | --- |
| `AFTERTONE_API_HOST`, `AFTERTONE_API_PORT` | `127.0.0.1`, `8017` |
| `AFTERTONE_WEB_HOST`, `AFTERTONE_WEB_PORT` | `127.0.0.1`, `5177` |
| `AFTERTONE_WEB_ORIGIN` | `http://127.0.0.1:5177`, trusted browser origin |
| `AFTERTONE_DATABASE_URL` | `sqlite:///./aftertone.sqlite3` |
| `AFTERTONE_COVER_DIR` | `./data/covers`, for both covers and portraits |
| `AFTERTONE_ENV` | `development` |
| `AFTERTONE_OWNER_PASSWORD_HASH` | Generated Argon2id hash, required to edit |
| `AFTERTONE_SESSION_SECONDS` | `43200` (12 hours) |

The Makefile runs the backend from `backend/`, so the defaults resolve to **`backend/aftertone.sqlite3`** and **`backend/data/covers`**. Run manual backend commands from the same directory. A different working directory with a relative SQLite URL can open or create a different database, which may look like an empty journal. Use an explicit absolute SQLite URL when intentionally pointing elsewhere.

Vite proxies `/api` and `/media` to the backend. The frontend uses same-origin requests by default; do not hardcode a LAN API address to work around local startup problems. If changing ports, update the web origin consistently and restart. Manual Uvicorn/Alembic commands need the environment loaded explicitly; the backend does not automatically source the root `.env`.

If an existing environment reports missing `argon2`, rerun `make setup` to install the declared dependencies into `backend/.venv`. A dependency listed in a lockfile is not necessarily installed in the interpreter currently running the app.

### Commands

| Command | Purpose |
| --- | --- |
| `make setup` | Prepare/update local dependencies and create `.env` if missing |
| `make dev` | Migrate, then run backend and frontend together |
| `make migrate` | Apply pending Alembic migrations to the configured database |
| `make backup` | Create a complete local journal snapshot |
| `make test` | Run backend and frontend tests |
| `make lint` | Python lint/format checks and frontend TypeScript checks |
| `make build` | Type-check and build the frontend |
| `make help` | Show the common commands |

For separate terminals, after setup:

```bash
# API terminal, starting from the repository root
set -a
source .env
set +a
cd backend
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --host "$AFTERTONE_API_HOST" --port "$AFTERTONE_API_PORT" --reload
```

```bash
# Frontend terminal, starting from the repository root
set -a
source .env
set +a
cd frontend
npm run dev -- --host "$AFTERTONE_WEB_HOST" --port "$AFTERTONE_WEB_PORT"
```

## Preserve your journal

The database and media are the durable journal; browser drafts are separate. Never delete or replace the SQLite file to resolve a migration error. Check the configured path and Alembic revision first, and keep a recoverable copy before schema upgrades.

Stop `make dev` with Ctrl+C (and stop any other application writers) before creating a complete snapshot:

```bash
make backup
```

The backup tool uses SQLite's online backup API, includes generated covers and portraits, and writes a manifest with schema revision, UTC timestamp and checksums. It verifies integrity and referenced media, excludes sessions/login-throttle rows from the backup copy, and does not modify the original journal. Archives default to `backend/data/backups`; `AFTERTONE_BACKUP_DIR` can select a different destination. Credentials/configuration must be retained securely and separately.

Keep encrypted copies off the application host and test restoration regularly. Daily scheduling, off-host transfer and retention are operator configuration, **not automatically installed by `make setup` or `make dev`**. The [backup and restore guide](docs/production/backup-restore.md) describes local/container backups, scheduling precautions and restoration into a new directory without overwriting live data. Do not use a plain file copy of a live SQLite database as the backup workflow.

## Optional public deployment

Local use remains the simplest way to keep a journal. For intentional public reading, the repository includes a multi-stage [Dockerfile](Dockerfile), [compose.yaml](compose.yaml), a [production environment template](.env.production.example) and a [Caddy configuration](deploy/Caddyfile). One non-root application container serves the built frontend, API and generated media, with SQLite/media on persistent storage.

Use one application replica/worker and local persistent disk. Production requires an owner hash, an exact HTTPS origin and absolute persistent database/media paths. Do not expose development servers or a raw SQLite file publicly. Interactive API documentation is disabled in production. Running local Make commands does not deploy the application.

Before deployment or upgrades, read:

- [Controlled deployment](docs/production/deployment.md)
- [Public guest mode and privacy boundaries](docs/production/public-guest-mode.md)
- [Security audit](docs/production/security-audit.md)
- [Release checklist](docs/production/release-checklist.md)
- [Backup and restoration](docs/production/backup-restore.md)

## Development and verification

Aftertone is a small modular monolith: FastAPI/SQLAlchemy/Alembic in the backend, React/TypeScript/Vite in the frontend, and SQLite for durable storage. No queue, separate accounts service or external music service is needed for manual journal use.

Backend tests configure a separate test SQLite path in `backend/tests/conftest.py`; migration/backup tests use synthetic data and isolated destinations. Keep tests and migration experiments off the personal database. Do not point test fixtures at your journal or run application migrations against it as a test.

For focused development checks, after `make setup`:

```bash
cd backend
.venv/bin/pytest tests/ratings/test_calculator.py
.venv/bin/pytest tests/favorite_songs
cd ../frontend
npm test -- --run src/features/ratings/ratingDraftStorage.test.ts
npm run lint
npm run build
```

For broader release verification, run `make test`, `make lint` and `make build` from the root. Frontend `lint` currently runs TypeScript checks, not a separate ESLint pipeline. There is no committed browser end-to-end suite; use the release checklist for manual navigation, responsive, privacy and recovery checks.

### Project layout and API

```text
backend/app/             API, models, schemas, ratings, imports and integrations
backend/alembic/         schema migrations
backend/tests/           isolated backend/domain tests
frontend/src/            React UI, API client and feature tests
scripts/                complete backup and safe restoration tools
docs/decisions/          architectural decisions
docs/production/         deployment, privacy, security and recovery runbooks
deploy/                 production entrypoint and reverse-proxy example
Makefile                local setup, startup and verification commands
.env.example            local configuration template; no credentials included
```

Development `/docs` documents the API contract. Main route families are `/api/albums` (metadata, revisions, media and revisit controls), `/api/artists` (metadata, portraits and tracks), `/api/favorite-songs`, `/api/auth`, legacy imports/reconciliation and `/api/metadata/musicbrainz`. The [API access inventory](docs/production/api-inventory.md) distinguishes public reads from owner-only operations.

### Rating model and durable decisions

Album scores are calculated authoritatively in [backend/app/ratings/calculator.py](backend/app/ratings/calculator.py), using `Decimal` and persisted numeric columns. For included track scores:

```text
P = mean of included track scores
M = (count(scores < 5) + 0.5 × count(5 ≤ scores < 7)) / included track count
C = coherence (0–10)
E = emotion (0–10)

coherence contribution      = +0.25 × (C / 10)²
bad experience contribution = −0.5 × M²
emotion contribution        = +0.025 × (E − 5) × (1 − M), if E > 5
                            = +0.025 × (E − 5), otherwise
final rating                = P + the three contributions
```

With no included tracks, there is no meaningful final rating. Latest Rating displays parameter values separately from their backend-provided impacts, using three decimals for contributions and the final score. Bad experience is stored as a proportion; its percentage display converts that proportion rather than changing the stored value. Favorite Songs has its own separate [backend calculator](backend/app/favorite_songs/calculator.py).

Other durable boundaries:

- Alembic is the schema authority; application startup does not create tables with `create_all`.
- Completed revisions are historical snapshots, not mutable views of current catalogue metadata.
- Album artist order is meaningful; primary and featured track credits are structured relationships.
- Legacy imports remain distinct until explicit reconciliation.
- Media is stored locally; database files, notes and backup archives are not served as public media.
- Missing ratings are distinct from a valid zero.

See [architectural decisions](docs/decisions/) for the rationale.

## Deliberate limits

- One owner and one journal: no registration, multi-user collaboration or built-in cross-device synchronization.
- No audio playback, streaming catalogue or objective claim behind personal ratings.
- No per-entry public/private switch for catalogue metadata or numeric history.
- Local drafts belong to a browser/device; they are not database backups or portable session sync.
- MusicBrainz is assisted import, not background synchronization; incomplete source metadata stays incomplete.
- Legacy multi-artist strings are not automatically split into canonical artists.
- Some ranking/history reads scale with the full personal catalogue. The application targets a personal collection, not a high-traffic music platform.
