# Railway volume initialization and quiescent maintenance

Status: accepted for implementation; actual Railway validation and deployment are owner actions.

Railway is the first deployment target: one existing-account service, one replica,
one mounted `/data` volume, SQLite and generated media together. Keep the current
Dockerfile, same-origin API/static serving and single Uvicorn worker. Compose remains
a separate VPS path. No cloud resources are created by this change.

Railway documents root-owned mounts and recommends `RAILWAY_RUN_UID=0` for non-root
images. Changing only the image's directory ownership is insufficient because the
runtime mount hides it. Setting a non-root UID alone does not change volume ownership.
[Railway volumes](https://docs.railway.com/volumes)

Use the documented root override only with `AFTERTONE_INIT_VOLUME=1` and the guarded
stdlib startup helper. It verifies the actual `/data` mount and contained storage paths,
rejects links/special files/cross-filesystem entries, fixes permissions only in that dedicated
volume (excluding filesystem `lost+found`), clears supplementary groups, and sets real,
effective and saved UID/GID to 10001 before loading application code or migrating.
Failure at any step prevents startup. The image's default USER remains 10001 for VPS
use; no sudo, setuid wrapper, extra runtime package or permanently privileged server.
Local Docker tests simulate the root-owned mount and inspect the resulting process IDs
and effective capabilities. Railway's actual setgroups/setgid/setuid support must still
be checked on the first controlled deployment; never fall back to running FastAPI as root.

Startup refuses missing Railway storage and requires explicit first-initialization
consent for a missing database. Remove that consent after first boot. An inherited
filesystem lock covers migrations and the serving process, preventing a second normal
runtime against the same volume. This supplements Railway's single mounted-deployment
behavior; it does not authorize multiple replicas or arbitrary direct SQLite writers.

Railway does not attach volumes during pre-deploy commands, so migrations stay in
startup. They run after privilege drop and must succeed before Uvicorn starts.
[Volume availability](https://docs.railway.com/volumes#volume-availability)

`AFTERTONE_MAINTENANCE=1` starts a small unprivileged stdlib HTTP process instead of the
application, skipping migrations. Only GET `/health` succeeds, explicitly identifying
maintenance; all application paths return 503. This permits SSH backup/restore with a
quiescent database/media set without a second service. It intentionally causes downtime.
SSH administration remains privileged platform access; invoke the startup helper for
backup commands to write as UID 10001. Do not invoke a second app or migrate manually.

Keep the rollback journal and 15-second busy timeout. There is no demonstrated reason
to change the database or its transaction semantics. No authentication, privacy,
rating, frontend design or historical snapshot changes are needed.
