# Final verification report

This is the historical initial-hardening report. For the selected hosting adaptation,
see the newer [Railway verification report](railway-verification.md) and
[Railway deployment runbook](railway.md).

Date: 2026-10-14. Baseline: `42b0e4e`. Validation used synthetic data and temporary
storage. No production deployment or personal database migration was performed.

## Executed successfully

| Check | Result |
|---|---|
| Full backend `pytest -q` (Python 3.13.5, isolated temporary environment) | **140 passed**, one Starlette TestClient/HTTPX deprecation warning |
| Backend `ruff check .` and `ruff format --check .` | Passed; applied migration history excluded from restyling |
| Validation environment `pip check` | No broken requirements |
| Post-update `pip-audit` | No known vulnerabilities reported |
| Post-update `npm audit` | Zero vulnerabilities reported |
| Frontend `npm run lint` (TypeScript checking) | Passed |
| Frontend `npm test -- --run` (Vitest 4.1.11) | **135 passed**, 33 files |
| Frontend `npm run build` | Passed, Vite 7.3.6 production assets |
| Fresh Alembic upgrade through `0017` | Passed in synthetic backup/restore test and container startup |
| Complete synthetic database/media backup and restore | Passed: exact revision scores/notes, artist relationships, covers, portraits, integrity/foreign-key checks, auth exclusion, overwrite and missing-media refusal |
| `docker build -t aftertone:security-audit .` | Passed, local multi-stage Linux amd64 image |
| Disposable production container smoke test | Passed: UID 10001, read-only rootfs, migrations, frontend/deep routes, public reads, denied anonymous writes, production cookies, CSRF writes, private notes, restart persistence, logout revocation and backup/restore |
| `docker compose config --quiet` | Passed with synthetic configuration; resolved secrets not printed |
| Caddy validation in disposable `caddy:2` container | Valid configuration; no published ports |
| Calculator definition AST comparison against baseline | Both existing calculators unchanged; imports/formatting only |
| Applied migration comparison against baseline | All 16 applied migrations byte-for-byte unchanged |
| `git diff --check` | Passed |
| Tracked artifact/targeted secret review | No current tracked databases, archives, environment secrets or private keys identified |

HTTP tests cover every administrative method/path including administrative GETs,
anonymous multipart uploads, public reads, login, production cookies, origin/CSRF
failures, expiry, persistent throttling, session replacement, hash rotation, logout,
nested privacy redaction, private-filter inference, chunked/body limits, workbook
expansion, image bombs, validated-IP/TLS-hostname pinning and production configuration.
Existing domain/snapshot regressions remain in the full suite. The new migration only
adds owner-session and login-throttle tables.

## Verification limitations and corrected issues

Sandbox registry/DNS access initially failed; audits/installations subsequently completed
with authorized network access. Sandbox thread/socket restrictions stalled TestClient;
the full HTTP/backend suite passed outside that sandbox. Failed attempts are not counted
as passes.

The installed npm 9 resolver crashed on the targeted Vitest update; temporary npm 10.9.4
completed it. Normal checks and Docker's clean `npm ci` then passed. A preexisting test
assertion hardcoded localhost media URLs and was corrected for same-origin serving.
The first container restart harness used a stale dynamically assigned loopback port;
re-inspecting the port corrected the harness and the complete test passed. Temporary
test containers and volumes were removed.

Python validation included development audit tools; Docker installs the exact production
lock plus the application. Advisory results are dated observations, not proof against
unknown vulnerabilities. Re-run them before release.

## Not executed / unresolved

- No live browser E2E, production DNS/TLS issuance, provider deployment test or live remote
  image import. Mocked transport tests verify pinning; check real TLS/imports on the host.
- No container OS/base-image CVE scan. Application audits do not replace that scan.
- No external backup account/transfer or restore from a remote provider. Complete local
  recovery passed; configure and test external delivery before release.
- Some history/ranking reads scale with the complete personal catalogue. No general
  internet-scale DDoS service is included.
- There is no per-entry publication control for catalogue/media or numeric history.
  Written notes and revisit state remain private. Review actual content before release.
- The global owner-login budget can be exhausted to temporarily deny new login.
- A non-failing Starlette HTTPX TestClient deprecation warning remains.

## Deployment gates and owner decisions

Choose a provider and budget; provision a unique owner hash; review public catalogue
and history; configure persistent storage/permissions and check a database copy for
foreign-key violations; configure encrypted external backups, scheduling, retention and
retrieval; validate browser/HTTPS, live image imports and OS image scanning; then approve
a separate controlled release. See `release-checklist.md`.

No significant architectural decision is awaiting approval. SQLite, the modular monolith,
formulas, revision snapshots and music relationships are retained. No public deployment
is authorized or performed by this work.
