# Security audit

Audit date: 2026-10-14. Scope: tracked working tree at baseline `42b0e4e`, backend,
frontend, configuration, migrations, media storage, backup script, and deployment path.
This is a source review and synthetic verification, not a penetration test of a live host.
No public deployment, production-data migration, or Git history rewrite was performed.

## Initial architecture

The repository was a local-only modular monolith: synchronous FastAPI endpoints in
`app/main.py`, SQLAlchemy models, 16 Alembic migrations, SQLite, React/TypeScript/Vite,
locally generated WebP covers and portraits, Excel import/reconciliation and MusicBrainz
lookups. Album and Favorite Songs calculators are distinct existing domains. Snapshot
regressions already covered catalogue edits and immutable ratings. The frontend lint
command is TypeScript checking; it is not an ESLint ruleset.

The working tree was clean. Tracked-file enumeration found no current SQLite files,
backups, `.env`, private keys, or database sidecars. A targeted pattern scan found no
secret candidates. A targeted `git log --all` path check found no matching sensitive
paths in the available history. This does not prove that a previously published secret
or removed personal artifact was never exposed. No history was changed; rotate any
credential known by the owner to have been published, and treat published personal
backups as already disclosed.

## Prioritized findings

Locations name original functions and routes, since Ruff changes line numbers.

| Severity | Location | Original issue and realistic impact | Remediation and final state | Public deployment blocker? |
|---|---|---|---|---|
| Critical | `app/main.py`: every POST/PUT/PATCH/DELETE, including imports, revisions, credits, images and Favorite Songs | No authentication or authorization; direct HTTP callers could corrupt/delete data or spend server resources | Fixed: explicit `require_owner` dependencies, Argon2id, server-side sessions, origin and CSRF checks; route inventory regression tests | Was blocking; fixed |
| High | `album_response`, `revision_response`, `favorite_song_response`, `GET /api/legacy-ratings/{id}` | Notes, revisit reasons and administrative legacy details were public | Fixed: request-local public serialization strips notes/revisit state, legacy and metadata reads require owner; nested privacy tested | Was blocking; fixed; owner must still review intended public catalogue/history |
| High | `services/covers.py:download_cover_from_url` | DNS was checked separately from the connection, allowing rebinding between resolutions | Fixed: validate every destination, connect to its numeric public address, preserve Host and verified TLS SNI, disable environment proxies; redirects revalidated | Was blocking; fixed |
| High | `preview_legacy_import`, `commit_legacy_import`, `imports/legacy_excel.py:preview_workbook` | Unbounded request/file reads and ZIP/XML expansion could exhaust resources | Fixed: 12 MiB ASGI request limit including chunked bodies, 10 MiB workbook limit, 32 MiB expanded ZIP/500 members, 2000 data rows/64 columns, bounded iteration, defusedxml, workbook closure | Was blocking; fixed |
| High | `services/covers.py:save_cover_data` | Pillow could decode very large images or vulnerable image formats before resize | Fixed: 16 million pixel limit, decompression warnings/errors rejected, image verification and reencoding retained, Pillow security update | Was blocking; fixed |
| High | `scripts/backup_aftertone.sh` | Only SQLite backed up, on the same host; portraits/covers and host loss prevented full recovery | Fixed tooling: complete checksummed archive, reference checks, exclusive destination, integrity checks, synthetic restoration. Off-host transport and scheduling require operator setup | Off-host recovery setup remains a release gate |
| High | `backend/pyproject.toml` Pillow 11; frontend Vitest/tinypool/source-map-js | Advisory database found affected image decoder and development tools; tooling vulnerabilities require their relevant attack preconditions | Fixed: Pillow 12.3, Vitest 4.1.11, compatible source-map-js update; pytest and isolated pip tooling patched; exact runtime lock | Was blocking; post-update audits clear |
| Medium | `config.py`, `main.py`, frontend `api/client.ts` | No production secret validation, localhost API default, production docs/CORS/settings not separated | Fixed: fail-closed production settings, same-origin client, credential-aware fetch, exact origin, docs disabled, CSP and other headers | Was blocking; fixed |
| Medium | `database.py`, container/deployment path | No explicit busy timeout, foreign-key enforcement or operational persistence/runbook | Fixed: 15s busy timeout, foreign keys per application connection, one worker, non-root image, persistent local volume and restore procedure | Storage preflight and host configuration remain release gates |
| Medium | `main.py:list_favorite_songs`, `get_artist`, `list_revisions` | Some collection responses/ranking work remain proportional to the owner's catalogue/history | Partially mitigated: normal lists have 100-row page caps; owner-only external lookups; request/concurrency/container limits. Full history/ranking pagination deferred to preserve contracts | Non-blocking at current personal scale; observe before wider traffic |
| Low | Python formatting/imports and deprecated Pydantic `json_encoders` | Inconsistent style and future maintenance warnings | Fixed: Ruff E/F/I/UP/B/SIM, safe fixes plus reviewed manual changes; explicit Decimal JSON serializer. Applied migrations left byte-for-byte intact | No |
| Low | `auth.py:throttle_login` | A global owner-account budget can be deliberately exhausted | Accepted: persistent 10 attempts/5min and generic credential errors; limits hash work without trusting forwarded IPs | No; review under actual abuse |

## Security properties and remaining limits

- ORM queries use bound SQLAlchemy expressions; no attacker-controlled SQL interpolation
  was found. The backup utility interpolates only fixed internal table/column names.
- Request schemas forbid extra fields, prevent direct calculated-score assignment, and
  keep Decimal domain math. Calculators received formatting/import cleanup only.
- Generated media filenames, traversal-safe StaticFiles, fixed backup member paths, and
  regular-file checks bound filesystem access. Original uploaded filenames are not stored.
- Public data includes album/artist metadata, artist life dates where entered, images,
  numeric rating revisions and dates, track scores, and Favorite Songs breakdown/history.
  Journal notes and revisit state are private. There is no per-album publishing toggle.
- All numeric revision history is currently selected as public; text is stripped. If the
  owner needs to hide particular historical scores or catalogue entries, do not publish
  that dataset until a selective-publication feature is added.
- MusicBrainz has a fixed HTTPS origin, one-request-per-second coordination, timeout and
  bounded retry, and now requires owner access. A slow upstream can occupy a worker
  thread; no public arbitrary upstream proxy exists. Image download tests mock the network;
  a live remote image/TLS integration check remains part of release validation.
- Backups exclude active authentication rows, but still contain private journal data:
  encrypt and restrict off-host copies. File permissions alone do not encrypt data.
- General public traffic has no distributed rate limiter. Caddy body/read timeouts,
  Uvicorn concurrency and container limits bound work; upstream DDoS protection remains
  a host/provider concern. No multi-host SQLite, shared network filesystem, or replicas.
- The TestClient dependency emits a deprecation warning about HTTPX integration. Tests
  pass; no runtime dependency was changed solely to suppress that warning.
- Base operating-system image scanning, real DNS/certificate validation, live browser E2E,
  off-host backup delivery, monitoring and host hardening require the chosen environment.

## Dependency review

Production Python packages remain separate from pytest/Ruff/pip-audit in the `dev`
extra. `requirements.lock` pins the exact production set used by Docker. Node production
packages are React/React DOM; Vite/Vitest/TypeScript stay in the build stage. Existing
runtime dependencies serve concrete features. SQLAlchemy stays on 2.0; no broad upgrade
of the application stack was attempted. FastAPI constraints were narrowed to the
verified release range. Recheck locks and image advisories before each release.

Initial pip-audit reported 49 records across Pillow, pip and pytest, including duplicate
advisory records. Post-remediation pip-audit reported no known vulnerabilities in the
isolated validation environment. Initial npm audit reported four affected packages,
including critical development-tool findings; post-remediation npm audit reported zero.
These results are dated database observations, not a guarantee against unknown issues.

References: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[HTTPX TLS hostname extensions](https://www.python-httpx.org/advanced/extensions/),
[Vitest advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9),
[tinypool advisory](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3),
[source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

## API and persistence inventory

See [api-inventory.md](api-inventory.md) for every application HTTP method and path,
its public/owner classification, and storage/external-I/O effects. Authentication is
always enforced in development too; an unset owner hash means read-only operation.

`main.py` remains large. Authentication was extracted into its own router; moving every
catalogue endpoint at once would add review risk without improving the tested boundary.
A further router split can follow independently. Existing migration history, personal
SQLite files and generated media were not edited.
