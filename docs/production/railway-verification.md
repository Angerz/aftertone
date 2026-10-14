# Railway adaptation verification

Date: 2026-10-14. Baseline code: `60c9d26`. The working tree already contained a README
rewrite; it was preserved untouched. No actual Railway project, service, volume,
subscription, secret, DNS record or deployment was created/accessed. No personal SQLite
file or generated media was used. All container fixtures and volumes were synthetic
and removed after testing. Local image tags remain available for review.

## Files changed by this task

| File | Purpose |
| --- | --- |
| `Dockerfile` | Copy the stdlib runtime helper; retain default USER 10001, build stages and image dependencies |
| `deploy/entrypoint.sh` | Exec the helper; preserve single-process signal handling |
| `deploy/runtime.py` | Mount/path guards, restricted permission repair, mandatory UID/GID drop, storage preflight, writer lock, migrations, normal/maintenance startup |
| `.env.production.example` | Commented Railway-only settings and one-time/maintenance flags; no credentials |
| `backend/tests/test_runtime.py` | Eight startup/mount/path/identity/lock/migration regressions |
| `scripts/smoke_railway.py` | Reproducible local root-volume simulation, persistent media/recovery tests and resource measurements |
| `docs/decisions/0011-railway-volume-initialization.md` | Privileged initialization and maintenance rationale |
| `docs/production/railway.md` | Ordered dashboard, domain, authentication, backup, recovery and cost procedure |
| `docs/production/deployment.md` | Link selected Railway path while preserving VPS instructions |
| `docs/production/backup-restore.md` | Route Railway operators to the quiescent export/recovery workflow |
| `docs/production/release-checklist.md` | Add actual-platform identity, persistence and Railway release gates |
| `docs/production/verification-report.md` | Link this newer verification without replacing the historical audit results |
| `docs/production/railway-verification.md` | This report |

Application/domain/frontend source, rating algorithms, historical migrations, dependency
versions/locks, backup archive format and Compose configuration were not changed.
No `railway.json` was introduced: the current official reference deprecates that legacy
format. Dashboard settings are explicit in the runbook; no IaC provisioning SDK is needed.
[Current Railway configuration reference](https://docs.railway.com/config-as-code/reference)

## Successful checks

| Check | Result |
| --- | --- |
| Backend `pytest -q` | **154 passed**, one existing Starlette/HTTPX TestClient deprecation warning |
| Backend `ruff check .` / `ruff format --check .` | Passed |
| Ruff checks/format for `deploy/runtime.py`, `scripts/smoke_railway.py` and startup tests with backend config | Passed |
| Frontend `npm run lint` | Passed existing TypeScript checking |
| Frontend `npm test -- --run` | **143 passed**, 34 files |
| Frontend `npm run build` | Passed; Vite 7.3.6, 91 modules |
| `pip-audit` in isolated temporary validation environment | No known vulnerabilities reported |
| `npm audit` | Zero vulnerabilities reported |
| Original and adapted Docker production builds | Both succeeded |
| Existing Compose `config --quiet` with synthetic owner variable | Passed; secrets not printed |
| `git diff --check` | Passed |

The existing frontend does **not** configure ESLint or have an ESLint script. ESLint
was not run and no unrelated lint toolchain was introduced; its actual `lint` script
is TypeScript checking, reported separately above.

The full backend suite ran outside sandbox thread/socket restrictions because threaded
HTTP TestClient stalls inside that sandbox. Tests used their configured isolated test
database, not the owner's journal. Audit tools queried advisory services with network
permission. An initial smoke harness did not handle intentionally exited containers
before port assignment; that harness was corrected and complete runs then passed.

## Container scenarios executed

The local simulation used Docker Linux amd64, one CPU, a 512 MiB memory limit, read-only
root filesystem, a writable synthetic volume, 64 MiB `/tmp`, a temporary host-loopback
port and injected container `PORT=18765`.

- Original image default USER against a root:root 0700 volume: startup rejected, reproducing
  the actual ownership blocker rather than assuming image-time chown is sufficient.
- Adapted root initializer with no first-boot consent: rejected missing database.
- Adapted root initializer with explicit consent: permission repair succeeded and all
  four real/effective/saved/fs UID/GID values of the serving process were 10001; `CapEff=0`.
- Fresh Alembic initialization, normal readiness, `/`, `/library`, public catalogue reads,
  production-docs/unknown-API 404s and anonymous-write denial passed.
- Invalid credentials, production secure cookie flags, owner writes, missing-CSRF denial,
  private-note redaction, logout revocation and unchanged revision scores passed.
- 3600×3600 synthetic cover and portrait uploads succeeded; stored bytes survived removal
  and recreation of the application container on the same volume without empty-DB consent.
- A second runtime against the same live volume was refused before migrations.
- Maintenance mode returned explicit maintenance health and 503 for UI/API/media/mutations;
  application migrations and the journal writer were absent in this mode.
- Complete archive creation under the dropped UID, archive download to the local machine,
  local verification/restore, volume-side restore into a new directory, and normal
  startup using the recovered database/media paths succeeded. Original paths were retained.
- The same image subsequently started through its default unprivileged USER with no
  Railway settings, all capabilities dropped and no-new-privileges enabled, validating
  the preserved VPS/Compose runtime path against durable synthetic data.

Unit tests additionally cover missing/wrong mount information, root without opt-in,
privilege-drop ordering, path escape/symlink refusal, ownership-walk symlink refusal,
missing-database consent, writer-lock conflict and failed migrations never executing
Uvicorn. These complement, rather than replace, actual Railway acceptance checks.

Reproduce without cloud access:

```sh
docker build -t aftertone:railway .
python3 scripts/smoke_railway.py --output /tmp/aftertone-railway-metrics.json
```

The optional `--baseline-image aftertone:railway-before` also reproduces the original
permission failure if that image has separately been built. The script never invokes
Railway CLI, provisions a cloud resource, or reads real account credentials.

## Measurements, not production estimates

From the final complete synthetic run (not a load test):

| Measurement | Local result |
| --- | ---: |
| Startup to normal readiness, including fresh migrations | 2.765 s |
| Replacement container startup on existing storage | 2.331 s |
| Idle Uvicorn RSS before login | 87.14 MiB |
| Peak Uvicorn RSS through Argon2 login | 151.37 MiB |
| Peak Uvicorn RSS after sequential 12.96 MP cover/portrait uploads | 240.96 MiB |
| RSS after 250-row Excel preview | 95.02 MiB |
| Cumulative process peak through Excel preview | 240.96 MiB (earlier image peak) |
| Cgroup recorded peak through the selected operations | 222.22 MiB |
| RSS after recovered database startup | 89.45 MiB |
| Default unprivileged VPS runtime RSS | 89.02 MiB |
| Median `/health`, 7 requests | 1.07 ms |
| Median album list, 7 requests, one synthetic album | 4.22 ms |
| SQLite-backed owner album creation | 29.05 ms |
| Argon2 owner login | 207.74 ms |
| Uncompressed Docker image size | 329.11 MiB |

RSS/HWM come from `/proc/1/status`; container values come from cgroup memory counters.
These use different shared-memory accounting and are not interchangeable. Counter
inspection and image/workbook generation use short-lived exec processes; cgroup peak
includes that activity. No additional measurement daemon remains running. Database
size and traffic were tiny; cold image downloads, real journals, 2000-row worst cases,
16 MP limit cases, concurrent hashing/uploads, CPU saturation and Railway's scheduler
were not benchmarked. No idle CPU or monthly Railway bill was measured.

The observed idle footprint did not justify a dependency rewrite, lazy-import refactor
or weaker hashing/image limits. Keep a 512 MiB initial memory ceiling with headroom,
then use actual Railway metrics. A 250-row preview does not certify worst-case Excel
memory. Concurrent Argon2 verifications each allocate roughly 64 MiB; simultaneous
owner operations or larger catalogues can exceed the serial-operation peak.

At published RAM pricing of $10/GB-month, an approximately 0.09–0.10 GB continuously
resident process suggests roughly $0.90–1.00/month for RAM alone. This is an estimate,
not a Railway reading; actual billable memory, CPU, volume/native-backup storage and
egress add cost. Combined with the owner's reported $3–4 existing usage, the $5 target
may fit under light use but cannot be promised. Existing Hobby credit is shared across
eligible usage, not multiplied by adding a project. No new subscription is assumed.
[Resource pricing](https://docs.railway.com/pricing), [Hobby allowance](https://docs.railway.com/pricing/plans)

## Remaining acceptance gates and risks

No cloud resources were available or authorized for testing. The owner must validate:

1. Railway's actual `RAILWAY_RUN_UID=0` behavior and permission-changing/privilege-drop
   syscalls on its mounted filesystem; serving UID/GID 10001 and zero effective capabilities.
   If any assertion fails, stop and investigate. Permanently running FastAPI as root is
   not an accepted fallback.
2. One mounted `/data` volume, one region/replica, correct `$PORT` routing, fresh migration,
   repeated redeploy persistence, and rejection of an empty replacement volume without consent.
3. Real HTTPS/browser cookies and Origin/CSRF on the temporary hostname, then the custom
   domain; DNS/TXT/certificate verification, real image import and optional sleep/wake.
4. Maintenance deployment replacing the old writer, real Railway SSH/file-transfer behavior,
   volume-relative download/upload paths, UID ownership after upload, and complete recovery
   of an archive actually retrieved from an independently retained encrypted copy.
5. Native-backup availability/retention/cost on the selected account; independent export
   cadence and recovery keys. No external destination or backup automation was provisioned.
6. Measured resource usage, chosen memory limits and combined billing. Manual exports need
   an operator schedule/log; no background backup service was added. Maintenance introduces
   intentional downtime, and volume-backed deploys also have brief downtime.

An OS/base-image CVE scan and live browser E2E were not performed. Prior publication
limits remain: numeric listening history/catalogue/media are public; written notes and
maintenance details remain private. There is no per-entry publication toggle.

There are no unresolved local build/test failures. Actual Railway privilege/mount tests,
production secrets, domain configuration, external backup retrieval and cost review are
operational gates before public release. Follow [the ordered runbook](railway.md).
