# Controlled production deployment

The repository is prepared for deployment; nothing has been deployed.
Railway is the selected first host: follow the ordered [Railway runbook](railway.md).
The VPS/Compose procedure below remains supported as a portable alternative. The intended
origin is `https://aftrtone.angerz.dev`, with the React client at `/`, API at `/api`,
and public generated media at `/media/covers`. Other projects on `angerz.dev` should
have separate hostnames, cookies, storage and reverse-proxy site blocks.

## Portable topology

One Python container serves the built frontend, API and media. It runs as UID/GID
10001 with a read-only root filesystem and a writable `/data` volume. SQLite and
both image types live there. On Railway only, an explicitly enabled initializer repairs
root-mounted volume ownership and drops to UID/GID 10001 before migrations/application
startup. The default image and Compose still start unprivileged. No database service,
queue, Redis or PostgreSQL is needed.
The Docker build uses Node 22 and Python 3.13; build tools and Node are absent from the
runtime. Exact Python runtime dependencies and the npm lockfile are used during build.

Use one application replica/worker and local disk, never NFS or an ephemeral filesystem
for SQLite. Foreign-key constraints and a 15-second busy timeout apply on application
connections. Transactions remain in the existing domain workflow. The default rollback
journal mode is retained; WAL is not necessary at this scale. Do not copy a live SQLite
file with `cp`; use the supplied backup utility. Startup applies Alembic before Uvicorn
and exits on migration/configuration failure. Back up before upgrades and inspect
release migrations; never run concurrent migration jobs.

Railway will use the existing Hobby account, one application service and one volume.
No additional subscription or database is required. Resource usage, storage, backups
and bandwidth remain billable; the combined US$5 target is not guaranteed. See the
Railway guide's measured-resource discussion and actual-platform acceptance gates.

## Owner provisioning and configuration

For local development, install the updated backend dev extra, generate the hash and
put it in `.env`, then use `make dev`:

```sh
cd backend
.venv/bin/pip install -e '.[dev]'
.venv/bin/python -m app.auth
```

The command prompts twice, requires at least 16 characters and prints only the hash.
Use a unique password stored in a password manager. There is no default password or
registration. Keep the hash single-quoted in shell/Compose env files because Argon2
hashes contain dollar signs. A provider secret UI expects the raw hash without quotes.
Never put credentials in `VITE_*`; those are public build inputs. Logging out revokes
the current session, logging in replaces previous sessions, and changing the configured
hash invalidates all previous sessions after the application is restarted/reconfigured.

Production settings are described in `.env.production.example`. Required: the owner
Argon2id hash and an exact HTTPS `AFTERTONE_WEB_ORIGIN`. Use absolute persistent database
and media paths. Session lifetime defaults to 43200 seconds, range 300–604800. Production
disables `/docs`, `/redoc`, `/openapi.json`. The frontend defaults to same-origin; its
optional `VITE_AFTERTONE_API_URL` is for intentional development setups only. The Vite
proxy reads the API port from the root `.env`; local port overrides continue to work.

Production cookies require HTTPS. The owner signs in using the small existing-style
sign-in form; anonymous users can browse without a session. A 401 clears client owner
state; a 403 reports the failed operation without blindly retrying it.

The editorial landing page is `/`; the catalogue is `/library`. See
[public guest mode](public-guest-mode.md) for the public route/field allowlist and
logout behavior. Cloudflare Tunnel can provide origin connectivity; do not put
the whole hostname behind Cloudflare Access if anonymous browsing is intended.
Owner authentication and CSRF protection remain enforced by Aftertone itself.

## Linux VPS procedure (run only when deployment is approved)

Install Docker with Compose and a supported Caddy release on the host. Create DNS for
the target hostname. Permit SSH and HTTPS/HTTP certificate issuance as appropriate;
do not expose port 8017 to the internet. The compose file binds it to loopback only.
Protect the project directory, env file and backup storage from other local users.

```sh
cp .env.production.example .env.production
chmod 600 .env.production
# Edit .env.production and set the generated owner hash.
mkdir -p backups
sudo chown 10001:10001 backups
chmod 700 backups
# Review this resolved configuration locally; it contains the password hash.
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
curl --fail http://127.0.0.1:8017/health
```

A fresh named volume is initialized with UID 10001 ownership by the image. Existing
bind-mounted data must already be owned by UID/GID 10001, directories 0700 and data
files 0600. Do not recursively change ownership on an unrelated path. If migrating
an existing journal, restore a tested complete snapshot into a new volume first;
never start a fresh empty volume and assume it contains the local journal.

Use `deploy/Caddyfile` as the host Caddy site configuration. Validate it before reload:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

TLS is terminated by Caddy, which proxies to loopback. Auth cookie security and CSRF
origin validation rely on explicit production settings, not forwarded headers. The app
trusts proxy headers only from loopback by default. For a platform's private proxy,
set `AFTERTONE_PROXY_IPS` to its actual trusted addresses; do not trust arbitrary public
forwarding headers. A containerized proxy requires its own private networking setup;
this compose file intentionally assumes host Caddy.

## Operations and portability

The container honors `PORT` (default 8017) for platforms such as Railway. Set production
variables, attach storage at `/data`, route HTTPS to that port, keep one replica, and
provide an external backup destination. No provider-specific SDK is required. A provider
without persistent disk is unsuitable for this configuration.

`/health` checks catalogue database readability and returns 503 on storage failure.
The Docker health check calls it locally. JSON application request logs contain method,
status and duration, without bodies, queries, cookies, credentials or filenames.
Uvicorn's access log is disabled in the entrypoint; server errors remain in stderr.
Compose rotates stdout/stderr logs. SIGTERM reaches Uvicorn through `exec`, allowing
request shutdown; failed transactions are rolled back when sessions close.

Container limits are starting values: 512 MiB, 128 PIDs, concurrency 32, 64 MiB tmpfs.
Measure imports and public traffic before increasing them. The reverse proxy limits
bodies and read duration. Throttling limits owner-login CPU work but can briefly deny
owner login under targeted abuse. No general DDoS service is included.

Before upgrades: stop writers, archive and copy off-host, test recovery, then rebuild
and start once. Do not automatically downgrade migrations against valuable data.
Rollback by restoring the pre-upgrade archive into a separate volume with its matching
application version. Never use `docker compose down -v` on production data.
