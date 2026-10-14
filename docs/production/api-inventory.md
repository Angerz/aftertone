# API and persistent-state inventory

Generated from reviewed route declarations; authentication is enforced server-side.
Public JSON removes journal notes and revisit state. Public collection filters for private
revisit state require owner access. No public GET changes journal state.

Public API reads are explicitly allowlisted in `app/auth.py:PUBLIC_READ_ROUTES`;
new API routes require owner authorization by default. Public response models
declare `_public_fields` projections. Artist maintenance filters also require owner
access. See [public guest mode](public-guest-mode.md) for the exact field contract,
the `/` landing and `/library` catalogue routes, and logout/cache behavior.

| Method | Path | Access | Effects |
|---|---|---|---|
| GET | `/health` | Public | Read catalogue table for storage readiness |
| POST | `/api/albums` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| GET | `/api/metadata/musicbrainz/releases/search` | Owner | MusicBrainz HTTPS lookup |
| GET | `/api/metadata/musicbrainz/artists/search` | Owner | MusicBrainz HTTPS lookup |
| GET | `/api/metadata/musicbrainz/artists/{artist_id}` | Owner | MusicBrainz HTTPS lookup |
| GET | `/api/metadata/musicbrainz/releases/{release_id}` | Owner | MusicBrainz HTTPS lookup |
| POST | `/api/metadata/musicbrainz/releases/import` | Owner + Origin + CSRF | Write artists/albums/tracks; optional public image download and media write |
| GET | `/api/albums` | Public | Read catalogue/rating SQLite rows |
| GET | `/api/albums/summary` | Public | Read catalogue/rating SQLite rows |
| GET | `/api/albums/facets` | Public | Read catalogue/rating SQLite rows |
| GET | `/api/albums/{album_id}` | Public | Read catalogue/rating SQLite rows |
| PATCH | `/api/albums/{album_id}` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| GET | `/api/artists` | Public | Read catalogue/rating SQLite rows |
| POST | `/api/artists` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| PATCH | `/api/artists/{artist_id}` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| DELETE | `/api/artists/{artist_id}` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| GET | `/api/artists/{artist_id}` | Public | Read catalogue/rating SQLite rows |
| GET | `/api/artists/{artist_id}/tracks` | Public | Read catalogue/rating SQLite rows |
| PUT | `/api/artists/{artist_id}/image` | Owner + Origin + CSRF | Reencode/write or delete generated media; update SQLite reference |
| DELETE | `/api/artists/{artist_id}/image` | Owner + Origin + CSRF | Reencode/write or delete generated media; update SQLite reference |
| POST | `/api/artists/{artist_id}/image/from-url` | Owner + Origin + CSRF | Public-address-pinned image HTTPS/HTTP download; generated media write; update SQLite reference; delete previous media |
| GET | `/api/favorite-songs` | Public | Read catalogue/rating SQLite rows |
| POST | `/api/favorite-songs` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| GET | `/api/favorite-songs/{entry_id}` | Public | Read catalogue/rating SQLite rows |
| PATCH | `/api/favorite-songs/{entry_id}` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| DELETE | `/api/favorite-songs/{entry_id}` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| GET | `/api/tracks/search` | Owner | Read catalogue/rating SQLite rows |
| PATCH | `/api/tracks/{track_id}/artists` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| PATCH | `/api/albums/{album_id}/revisit` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| DELETE | `/api/albums/{album_id}/revisit` | Owner + Origin + CSRF | Write catalogue/rating SQLite rows; transaction commit/rollback |
| POST | `/api/imports/legacy-ratings/preview` | Owner + Origin + CSRF | Bounded XLSX processing; database duplicate reads; no journal write |
| POST | `/api/imports/legacy-ratings/commit` | Owner + Origin + CSRF | Bounded XLSX processing; database duplicate reads; write selected albums/artists/legacy rows, per-row transactions |
| GET | `/api/legacy-ratings/{legacy_rating_id}` | Owner | Read catalogue/rating SQLite rows |
| POST | `/api/legacy-ratings/{legacy_rating_id}/reconcile` | Owner + Origin + CSRF | Read legacy data; create track mapping and immutable native revision; update legacy reconciliation state |
| POST | `/api/legacy-ratings/{legacy_rating_id}/reconcile-preview` | Owner + Origin + CSRF | Read legacy/current tracks; calculate preview without journal writes |
| PUT | `/api/albums/{album_id}/cover` | Owner + Origin + CSRF | Reencode/write or delete generated media; update SQLite reference |
| POST | `/api/albums/{album_id}/cover/from-url` | Owner + Origin + CSRF | Public-address-pinned image HTTPS/HTTP download; generated media write; update SQLite reference; delete previous media |
| DELETE | `/api/albums/{album_id}/cover` | Owner + Origin + CSRF | Reencode/write or delete generated media; update SQLite reference |
| POST | `/api/albums/{album_id}/revisions` | Owner + Origin + CSRF | Read current tracks; write immutable revision and score snapshots |
| GET | `/api/albums/{album_id}/revisions` | Public | Read catalogue/rating SQLite rows |
| GET | `/api/albums/{album_id}/revisions/{revision_id}` | Public | Read catalogue/rating SQLite rows |
| GET | `/{path:path}` | Public | Read built frontend index (SPA fallback; unknown API/media/docs paths remain 404) |
| POST | `/api/auth/login` | Trusted Origin + credentials + throttle | Read password hash; update login throttle and replace session rows; set cookie |
| GET | `/api/auth/session` | Public status; details only for valid session | Read session row when cookie supplied; never disclose bearer token |
| POST | `/api/auth/logout` | Owner + Origin + CSRF | Delete session row; clear cookie |

Static mounts: `/media/covers` publicly reads only the configured generated-media directory;
`/assets` publicly reads the built client assets when a frontend build is present.
Development-only generated docs/schema routes: GET/HEAD `/docs`, `/docs/oauth2-redirect`,
`/redoc`, `/openapi.json`; absent in production. StaticFiles supports GET/HEAD.

All cookie-bearing application reads also consult the owner session table. Sessions are
never written by GET. SQLite connections register search normalization, busy timeout and
foreign-key enforcement. Alembic startup is the only schema-changing operational path.

Outside HTTP: `python -m app.auth` prompts and prints an Argon2id hash without writing it;
`scripts/backup.py create` reads journal/media, writes a new archive and removes auth rows
only from its copied database; `restore` writes only to a new destination. The shell wrapper
reads trusted local configuration. The container entrypoint runs forward migrations.
