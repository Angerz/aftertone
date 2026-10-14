# Railway deployment and recovery

Reviewed 2026-10-14 against Railway's current documentation. Nothing has been deployed,
no cloud resources or subscriptions were created, and no production credentials were
accessed. The owner's existing Django/PostgreSQL application is outside this change.

## Compatibility audit

Already compatible: one multi-stage production image; frontend at `/` and `/library`;
FastAPI at `/api`; public generated images at `/media/covers`; database readiness at
`/health`; same-origin fetch; exact Origin plus CSRF; Secure/HttpOnly/host-only cookies;
`0.0.0.0:$PORT`; one Uvicorn worker; absolute SQLite/media paths; Alembic before serving.
No Nginx, Caddy, frontend service or additional database is needed on Railway.

Actual gaps: root-owned mounted-volume permissions, missing-volume/empty-database
protection, a quiescent backup procedure without host filesystem access, explicit
Railway settings, and measured memory/cost guidance. These are handled below and by
`deploy/runtime.py`; [ADR 0011](../decisions/0011-railway-volume-initialization.md)
explains the permission and maintenance decisions.

## Ordered first deployment

1. **Use the existing subscription.** In the existing Hobby workspace/account, create
   a separate empty project named Aftertone. Confirm billing belongs to that existing
   subscription. Do not upgrade, start a second subscription, import a database template,
   or change the Django/PostgreSQL project's settings. Review costs before creating
   anything; these are instructions for the owner, not actions already performed.

2. **Create one empty application service**, named `aftertone`, in its production
   environment. Configure it before connecting GitHub so the first deployment has
   storage and secrets. An alternative GitHub-first service may immediately attempt
   deployment; our startup guard rejects missing Railway storage rather than creating
   an ephemeral journal. Do not add worker/cron/proxy services or preview environments.

3. **Attach one persistent volume at `/data`.** Use a dedicated Aftertone volume in
   the service's region. Do not attach the other project's volume or use a network
   filesystem. Start with modest capacity appropriate for current media, and leave
   room for a full database/media copy plus archive and a restore directory. Volume
   storage is billed; review capacity and actual usage in the dashboard.

4. **Generate the owner hash locally**, with the updated declared backend environment:

   ```sh
   (cd backend && .venv/bin/python -m app.auth)
   ```

   Follow both prompts, store the password securely, and paste the resulting raw
   Argon2id hash into Railway's service-variable/secret UI. Do not include shell quote
   characters, commit the hash, send it to chat, or put it in `VITE_*`. This workflow
   has generated only synthetic test hashes, never the owner's production hash.

5. **Reserve a temporary Railway domain** in Settings → Networking → Public Networking
   → Generate Domain. Use the assigned `*.up.railway.app` hostname in the exact web
   origin below. If the UI offers domain generation only after the first deployment,
   initially use `https://aftrtone.angerz.dev`, verify public health, then set the
   assigned temporary HTTPS origin and redeploy before attempting owner login.
   The target port must match the actual `PORT` shown by Railway/Uvicorn, not an
   assumed 8017. Railway terminates HTTPS; its private hop to Uvicorn can remain HTTP.
   [Domain setup](https://docs.railway.com/networking/domains/working-with-domains)

6. **Set service variables**, only on Aftertone. The template's final domain becomes
   the trusted origin at cutover; use the temporary domain during its validation.

   | Variable | Value / handling |
   | --- | --- |
   | `AFTERTONE_ENV` | `production` |
   | `AFTERTONE_WEB_ORIGIN` | `https://YOUR-ASSIGNED-HOST.up.railway.app` initially; no trailing slash |
   | `AFTERTONE_OWNER_PASSWORD_HASH` | Locally generated Argon2id hash, raw secret UI value |
   | `AFTERTONE_DATABASE_URL` | `sqlite:////data/aftertone.sqlite3` |
   | `AFTERTONE_COVER_DIR` | `/data/covers` |
   | `AFTERTONE_SESSION_SECONDS` | `43200` |
   | `RAILWAY_RUN_UID` | `0`, solely to permit the guarded initializer below |
   | `AFTERTONE_INIT_VOLUME` | `1`, enables permission repair followed by mandatory privilege drop |
   | `AFTERTONE_ALLOW_EMPTY_DATABASE` | `1` for a deliberately fresh journal only; remove after first successful initialization |
   | `AFTERTONE_MAINTENANCE` | Omit/`0` normally; `1` for import/recovery/quiescent backup |
   | `AFTERTONE_MUSICBRAINZ_CONTACT` | Your public contact URL, optional metadata lookup identification |
   | `PORT` | Prefer Railway's injected value; if manually configured, set the public target port to the same value |

   Railway supplies `RAILWAY_SERVICE_ID` and `RAILWAY_VOLUME_MOUNT_PATH`; do not forge
   these in the dashboard. Startup requires an actual mount at `/data`, rejects
   storage paths outside it or through symlinks, and never loads FastAPI as root.

   **Permission rationale:** Railway explicitly documents root-mounted volumes and
   its UID override. Image-time `chown` is hidden by that mount. Our initializer limits
   ownership repair to this dedicated volume, rejects unsafe file types, applies
   0700 directories/0600 files, clears supplementary groups and drops all UID/GID
   identities to 10001. Compose keeps its existing unprivileged default. If Railway
   rejects any privilege-drop syscall, deployment must fail; do not remove the guard
   or keep the application running as root. Verify the real platform behavior below.
   [Volume permissions and availability](https://docs.railway.com/volumes)

7. **Configure build and deployment settings manually.** Then connect Source to
   `Angerz/aftertone`, branch `main` (or the explicitly reviewed release branch).
   Make sure the reviewed changes are on that branch before triggering deployment.

   | Dashboard setting | Required value |
   | --- | --- |
   | Service root / build context | Repository root `/`, not `backend/` or `frontend/` |
   | Builder | Dockerfile; root `Dockerfile` detected/selected |
   | Dockerfile path | `Dockerfile` |
   | Custom build command | Empty; Dockerfile builds both parts |
   | Custom start command | Empty; preserve the Docker entrypoint |
   | Pre-deploy command | Empty; mounted-volume migrations must remain in startup |
   | Health path / timeout | `/health`, 300 seconds |
   | Restart policy | On Failure, maximum 10 retries; inspect failures instead of an endless migration loop |
   | Replicas / regions | Exactly one replica in one region |
   | Initial resource limits | 1 vCPU and 512 MiB RAM if the dashboard supports them; measure before reducing |
   | Serverless / sleep | Disabled for initial validation; evaluate later with a wake/restart test |
   | Public networking | One HTTP domain routed to the actual `$PORT`; no SQLite/TCP exposure |
   | Automatic branch/preview deploys | Disable previews/extra environments; stage production upgrades around backups |

   There is deliberately **no `railway.json`**: Railway currently marks this legacy
   configuration as deprecated, with existing legacy services supported only until
   2026-12-01. Introducing its replacement IaC SDK merely to manage one manually
   configured service would add unrelated provisioning machinery. Docker is the
   executable build/start source; this table is the dashboard configuration reference.
   Compose is not consumed by Railway. Recheck this decision if Railway changes its
   configuration interface. [Current reference](https://docs.railway.com/config-as-code/reference)

8. **Deploy once and initialize the database.** New empty journal: use the one-time
   allowance above. Existing journal: begin in maintenance mode with the allowance
   omitted and restore as described below before normal startup. The volume mounts
   before the entrypoint; after privilege drop, preflight verifies filesystem writes,
   a volume lock excludes another runtime, Alembic upgrades, then Uvicorn starts.
   A failed migration prevents serving. Do not put SQLite migration commands in a
   Railway pre-deploy job or use `railway run`: that command executes locally, not
   against the remote mounted volume. Never attach another database-writing replica.

9. **Verify readiness and identity on the temporary hostname.** Check deployment logs
   for `runtime_identity` with UID/GID 10001 and a successful Alembic revision. Then:

   ```sh
   curl --fail https://YOUR-ASSIGNED-HOST.up.railway.app/health
   curl --fail https://YOUR-ASSIGNED-HOST.up.railway.app/library >/dev/null
   curl --fail https://YOUR-ASSIGNED-HOST.up.railway.app/api/albums
   curl -i -X POST https://YOUR-ASSIGNED-HOST.up.railway.app/api/artists \
     -H 'Content-Type: application/json' -d '{"name":"Anonymous must be rejected"}'
   # Last request must return 401 and create nothing.
   ```

   In the browser, sign in, create a synthetic album/revision, upload a small cover
   and portrait, confirm private notes are absent in a separate anonymous session,
   log out and verify editing is denied. Inspect cookies: `__Host-`, Secure, HttpOnly,
   SameSite=Strict, Path=/, no Domain attribute. Verify missing CSRF is rejected.
   If readiness returns `{"status":"maintenance"}`, this is the deliberately paused
   service, not a usable journal. Normal health is `{"status":"ok"}`.

   Use the dashboard's Copy SSH Command, or a current authenticated Railway CLI linked
   **only to Aftertone**, to inspect the main process:

   ```sh
   railway ssh --service aftertone -- cat /proc/1/status
   ```

   Expect all four `Uid`/`Gid` values to be 10001 and `CapEff` zero. The platform's SSH
   shell itself may use UID 0 because of the runtime override; the serving process
   must not. Check this on the actual deployment: local Docker cannot prove Railway's
   runtime restrictions. Railway health checks gate rollout, not continuous uptime
   monitoring. A volume-backed rollout has brief downtime.
   [Health behavior](https://docs.railway.com/deployments/healthchecks)

10. **Remove the one-time empty-database allowance**, then redeploy and restart once.
    Confirm the same journal, historical score, cover and portrait persist. Without
    the flag, an accidentally empty/replaced volume fails startup instead of becoming
    a new journal. Keep one replica and the same volume ID/mount path. The rollback
    journal, 15-second busy timeout, foreign keys and existing transactions are retained.

11. **Optional local journal restoration.** Stop local application writers, create
    a complete archive using the existing backup tool, and verify it locally first.
    Put Railway into maintenance, upload only that archive to a staging location,
    restore to a new directory and switch the two storage variables. The commands
    and rollback procedure below retain the original data; no live file is overwritten.

12. **Attach the custom domain.** Add `aftrtone.angerz.dev` in this service's Public
    Networking settings. Add exactly the CNAME and verification TXT records shown by
    Railway and wait for HTTPS/certificate verification. Do not change root-domain
    records or the Django project's domain. Set `AFTERTONE_WEB_ORIGIN` to
    `https://aftrtone.angerz.dev`, redeploy, then repeat the browser checks there.
    Cookies do not migrate between hostnames; sign in again. The former temporary
    origin is no longer trusted for writes. Remove its public domain if desired.
    [Custom-domain instructions](https://docs.railway.com/networking/domains/working-with-domains)

13. **Keep proxy and auth settings strict.** No wildcard trusted proxy or origin is
    needed. Leave `AFTERTONE_PROXY_IPS` unset (loopback only); cookie security is based
    on explicit production mode and CSRF compares the browser's exact Origin. Current
    responses use relative media URLs and do not require an inferred external scheme.
    Never set forwarded trust to `*` just to make login work. Validate browser behavior
    after domain changes and upgrades. The existing public-data contract still applies.

## Complete backups without another Railway service

Use Railway's native volume backups as an additional recovery layer, not the only
copy. Current docs support manual/scheduled snapshots for volume content including
SQLite; incremental retained data is charged at volume rates, with capacity limits.
Confirm the Backups tab and cost in this Hobby service before enabling a schedule.
Copies remain within Railway and cannot replace an independently retained export.
No native schedule, bucket, paid backup service or cron service is created here.
[Native backup behavior and limits](https://docs.railway.com/volumes/backups)

For CLI operations, install/update the [official Railway CLI](https://docs.railway.com/cli)
on the owner's trusted machine, authenticate, and explicitly link only Aftertone:

```sh
railway login
railway link
# Select the Aftertone project, production environment and aftertone service.
railway status
```

Confirm the displayed project/service before continuing. Copy the dedicated Aftertone
volume ID from its dashboard; the file commands below use that explicit ID to avoid
selecting an unrelated volume. Set `AFTERTONE_VOLUME_ID` locally, not as a service secret.

For portable recovery, use the existing complete archive tool while no journal writer
is running. Do not just download the active SQLite file or run a second service that
assumes it can share this mounted volume. Every command below targets Aftertone.

1. Set `AFTERTONE_MAINTENANCE=1` on Aftertone and deploy the reviewed image. Wait for
   the successful maintenance deployment and verify `/health` reports maintenance,
   `/api/albums` returns 503, and the previous writer has stopped. This skips migrations,
   so use this mode for pre-upgrade backups too. Pause automatic application upgrades
   while the snapshot/restore operation is in progress. Disable sleep temporarily if
   needed for SSH access. Do not stop the service and then expect SSH to work.

2. Use a unique UTC filename. The example is deliberately fixed so each command matches;
   replace it consistently and never reuse it. In a linked Aftertone CLI session:

   ```sh
   railway ssh --service aftertone -- python /app/runtime.py python /app/scripts/backup.py create \
     --database /data/aftertone.sqlite3 --media /data/covers \
     --destination /data/backups/aftertone-2026-10-14T030000Z.tar.gz
   ```

   The helper drops the SSH command to UID 10001 before writing. If currently using
   restored storage, substitute the configured database/media paths. Verify sufficient
   free volume space before making the copy. The archive includes every generated
   cover/portrait, consistent SQLite and a checksummed manifest; credentials stay
   separately in protected configuration. Active authentication rows are excluded.

3. Download the **completed archive**, never the running database, to a trusted local
   machine. Current Railway CLI supports volume file transfer; paths here are relative
   to the root of the mounted volume. Select/confirm the dedicated Aftertone volume:

   ```sh
   umask 077
   AFTERTONE_VOLUME_ID=replace-with-the-dedicated-Aftertone-volume-ID
   railway volume files --volume "$AFTERTONE_VOLUME_ID" download \
     /backups/aftertone-2026-10-14T030000Z.tar.gz ./aftertone-2026-10-14T030000Z.tar.gz
   python3 scripts/backup.py restore \
     --archive ./aftertone-2026-10-14T030000Z.tar.gz \
     --destination /tmp/aftertone-recovery-2026-10-14
   ```

   The destination must not exist. The restore verifies manifest/checksums and SQLite
   integrity/foreign keys. Inspect ratings, private notes, artists and both media types
   in a private local test. Download does not grant an unattended backup schedule.
   [CLI file transfers](https://docs.railway.com/cli/volume)

4. Encrypt a retained copy using your existing trusted local encryption/storage workflow.
   For example, with `age` already installed:

   ```sh
   age -p -o aftertone-2026-10-14T030000Z.tar.gz.age aftertone-2026-10-14T030000Z.tar.gz
   # Separate later retrieval/verification; destination must be new:
   age --decrypt -o /tmp/retrieved-aftertone.tar.gz aftertone-2026-10-14T030000Z.tar.gz.age
   python3 scripts/backup.py restore --archive /tmp/retrieved-aftertone.tar.gz \
     --destination /tmp/aftertone-retrieved-recovery-2026-10-14
   ```

   Retain passphrases/recovery keys separately. Keep the encrypted archive on an
   existing independent device/location outside Railway, and verify retrieval. No new
   external storage service is authorized or provisioned. A laptop-only copy is useful
   independence from Railway, but device loss still calls for a second retained copy.

5. Remove maintenance and deploy/restart, checking normal health and public browsing.
   Keep at least a pre-upgrade snapshot and an independently retrieved verified copy;
   set your backup interval to the amount of journal loss you can accept (daily/after
   editing sessions initially). Keep a dated backup log and a restore drill after schema
   changes. Native retention and independent retention are separate policies. Automating
   this later from an existing trusted machine avoids a new always-running Railway
   service; deploying an extra cron/storage service would require a separate cost and
   access decision. Manual exports must actually be performed to constitute protection.

### Restore on Railway without replacing live data

Enter maintenance first. Upload a previously downloaded/verified archive to a unique
location, then restore alongside the current journal:

```sh
# Use the dedicated volume ID already verified above.
railway volume files --volume "$AFTERTONE_VOLUME_ID" upload \
  ./aftertone-2026-10-14T030000Z.tar.gz /backups/recovery-2026-10-14.tar.gz
railway ssh --service aftertone -- python /app/runtime.py python /app/scripts/backup.py restore \
  --archive /data/backups/recovery-2026-10-14.tar.gz \
  --destination /data/recovered-2026-10-14
```

Change these two variables, keep maintenance until the paths have been reviewed,
then remove maintenance and deploy:

```dotenv
AFTERTONE_DATABASE_URL=sqlite:////data/recovered-2026-10-14/aftertone.sqlite3
AFTERTONE_COVER_DIR=/data/recovered-2026-10-14/covers
```

Do not enable the empty-database allowance for a restore. Startup checks the existing
database and applies only required forward migrations. Verify health, data, images and
private/public behavior, then sign in again (sessions were excluded from the backup).
The original `/data/aftertone.sqlite3` and `/data/covers` remain available for recovery.
Use fresh directory names on subsequent restores. Do not switch back to a database
whose schema is newer than the code you intend to run.

## Rollback and recovery

For a failed code deployment, inspect logs and keep the volume. Railway rolling back
code does not reverse SQLite migrations. For schema/data recovery, deploy the matching
previous reviewed image in maintenance, restore its pre-upgrade archive into a new
directory, switch storage variables and only then resume normal serving. Retain the
old directory/volume until recovery is verified. Never wipe/detach the only volume,
reset migration history, run a destructive downgrade or delete the other application's
resources to make room. A missing mount, refused privilege drop, failed migration or
wrong storage path is a blocking configuration error; investigate rather than bypass.

## Resource use and cost monitoring

One normal Uvicorn process serves all traffic; no scheduler or background worker is
introduced. The tiny maintenance process replaces it only during explicit downtime.
The initializer execs Uvicorn, so it does not remain as an extra resident supervisor.
Runtime dependencies are unchanged: Pillow/openpyxl serve concrete existing features;
Node and dev tools remain in build stages. SQLite journal/transaction behavior remains
unchanged. Keep generous peak headroom; lower memory limits do not lower the cost of
RAM the app actually retains. Argon2 verification uses 64 MiB per in-flight verification;
image conversion and two read-only workbook loads have additional transient memory.
Do not weaken hashing or decoder/import limits to hit a billing target.

See [Railway verification](railway-verification.md) for locally measured startup, RAM,
API timings and synthetic operation peaks. These are not Railway measurements or a
promise about your actual journal's usage. Initially keep 512 MiB, one CPU and one
replica; adjust from Railway Metrics after imports and real browsing. If concurrent
owner operations exceed headroom, increase the limit or restrict operation concurrency
rather than dropping security settings.

Current published resource rates are RAM $10/GB-month, CPU $20/vCPU-month, volume
$0.15/GB-month and egress $0.05/GB. The existing Hobby subscription includes $5 of
resource usage across its eligible workspace usage; it is not another $5 per project.
The owner's observed Django/PostgreSQL usage of $3–4 leaves only an approximate $1–2,
and that can change. For example, 0.15 GB continuously retained adds roughly $1.50
for RAM alone; CPU, media/storage, native backup increments and egress are additional.
Combined usage may therefore exceed $5. No new subscription is assumed, and no fixed
combined monthly price is guaranteed. Check current rates and the actual Usage/Billing
projection after 24–72 hours, then a full billing cycle.
[Pricing](https://docs.railway.com/pricing), [Hobby allowance](https://docs.railway.com/pricing/plans)

Configure usage alerts without changing limits that could stop the existing Django
application. Account/workspace hard spend limits can affect other services; prefer
reviewing Aftertone's service metrics and carefully chosen alerts. Serverless may save
idle compute but adds wake latency and repeats initialization/migrations; first verify
volume, startup, cookies, health and SSH backup behavior with a real sleep/wake cycle.
Do not assume it sleeps merely because no browser is open, or promise savings before
measuring its activity. [Serverless behavior](https://docs.railway.com/deployments/serverless)

## Actual Railway acceptance gates

Local Docker simulates a real root-owned mount and confirms the privilege drop, but
cannot certify Railway's UID override, capabilities, volume filesystem, file-transfer
ownership, account features, dashboard settings, edge HTTPS, DNS, or billing. On the
first controlled Railway deployment, verify UID/GID/capabilities, mount persistence
across a redeploy, failure without first-boot consent, browser auth/CSRF on each domain,
maintenance SSH/archive download/upload/recovery, native-backup availability/cost, and
usage metrics. Repeat sleep/wake checks before enabling serverless. Any failed storage
or privilege assertion blocks release; never replace it with a root-running API.
