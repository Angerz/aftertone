# Release checklist

Nothing in this change authorizes public deployment. Complete the unchecked operational
items against the chosen host, then obtain owner approval to publish.

## Code and security gates

- [ ] Review `security-audit.md`, the API inventory and final verification report.
- [ ] Run backend tests, `ruff check .`, and `ruff format --check .` from `backend/`.
- [ ] Run frontend TypeScript lint, tests and production build.
- [ ] Re-run pip-audit and npm audit using current advisory databases.
- [ ] Build the production image and scan its OS packages with the chosen image scanner.
- [ ] Check the diff contains no generated databases, personal media, archives or secrets.
- [ ] Confirm applied migrations were not rewritten and upgrade the restored test copy.

## Owner decisions and operational blockers

- [ ] Follow the [Railway runbook](railway.md) in the existing Hobby workspace; confirm
      one service/replica/volume, region, resource limits and combined usage projection.
- [ ] Verify Railway root-volume initialization drops the serving process to UID/GID
      10001 with no effective capabilities; remove first-boot database consent after initialization.
- [ ] Review the actual dataset: all catalogue metadata/images and numeric revision history
      become public. Notes/revisit state stay private. If selective album/history publishing
      is needed, implement it before release.
- [ ] Provision a unique strong owner password hash in protected configuration.
- [ ] Configure the exact HTTPS origin and validate cookie behavior in a real browser.
- [ ] Review existing data for foreign-key violations using a copy; resolve problems explicitly.
- [ ] Mount persistent local storage with UID 10001 ownership and restricted permissions.
- [ ] Configure off-host encrypted backups, retention, scheduling and failure alerts.
- [ ] Download and restore a snapshot from that external destination into a separate volume.
- [ ] Configure Railway HTTPS/temporary domain, then the custom domain and exact origin.
      For the alternative VPS path, configure Caddy/firewall/host patching.
- [ ] Verify public reads and denied direct anonymous writes, uploads, imports and admin GETs.
- [ ] Verify owner sign-in/edit/rate/upload/import/logout and expired-session handling in a browser.
- [ ] Verify live remote image import (DNS pinning, TLS/SNI, redirect behavior) on that host.
- [ ] Verify application restart preserves data/media, health monitoring and log rotation.
- [ ] Obtain explicit owner approval for controlled deployment, then publish separately.

No architectural approval is currently pending. The code keeps SQLite, one worker and
one application container; it does not require any new service account or hosting plan.
Railway is selected. Public content review, external backup retention and the final
deployment remain owner actions; no cloud resources are created by these changes.
