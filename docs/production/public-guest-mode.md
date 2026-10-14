# Public guest mode and owner access

The frontend at `/` is the editorial landing page. `Explore as guest` opens
`/library`; an authenticated owner can open Library directly. Existing filtered
links such as `/?year=2025` and the `/albums` alias are normalized to `/library`
without adding a history entry. Artists, albums, Favorite Songs and artist track
catalogues retain their existing routes. `/login` opens the existing owner form.

## Public API contract

`app/auth.py:PUBLIC_READ_ROUTES` is the explicit GET allowlist. It covers:

- `/health` and `/api/auth/session` (anonymous session status only).
- `/api/albums`, `/api/albums/summary`, `/api/albums/facets`, `/api/albums/{album_id}`.
- `/api/albums/{album_id}/revisions` and individual revision reads.
- `/api/artists`, artist details and `/api/artists/{artist_id}/tracks`.
- `/api/favorite-songs` and individual Favorite Song entries.

Public response models declare their permitted fields through `_public_fields`.
New fields are not automatically published. Public information includes catalogue
names, covers/portraits, release metadata, artist biography and structured credits,
track lists, numeric scores and score breakdowns, public rating dates/history,
Favorite Song genres, canonical positions and movement indicators. A valid score
of zero remains visible. The existing numeric legacy ratings remain visible, but
legacy import IDs, timestamps and reconciliation status are private.

Notes (`notes` and all `*_notes`) are serialized as null at every nesting level.
Revisit flags/reasons/timestamps remain private. Album creation timestamps and
MusicBrainz linkage, normalized artist names and artist maintenance flags are
excluded from public responses. Guest filtering by revisit, artist active status
or unused status is rejected so it cannot reveal those private flags indirectly.

All other API routes require the existing owner session, even GET routes. This
includes MusicBrainz lookups, legacy source records and track search for adding
favorites. Every mutation, upload, import and preview requires owner authorization,
trusted Origin and CSRF. Login is the sole anonymous POST exception, protected by
its existing password verification, trusted Origin and persistent throttle.
Static `/assets` and generated `/media/covers` are public; this does not expose
database files, source images, notes, import workbooks or backup archives. The
SPA fallback rejects unknown API/media paths instead of serving them as HTML.

## Session transitions

The existing `OwnerOnly`/`useOwner` state controls editing affordances. Restricted
frontend URLs replace themselves with `/library` and offer the shared sign-in
form. Successful logout revokes the server session, clears the client CSRF token,
replaces the current route with `/`, and remounts the application as a guest.
Previously loaded private views are discarded. Late responses from a prior session
are rejected, API reads remain `no-store`, and restoration from the browser's
back/forward cache rechecks the session before rendering application content.

Local listening drafts keep their existing format and storage keys on the owner's
device. Guest routes never mount the editor or load those drafts. Logout does not
delete them. As with existing local storage, a shared browser profile is not a
secure vault against someone with physical access or developer tools.

## Deployment boundary

This feature does not deploy anything. At `aftrtone.angerz.dev`, a Cloudflare Tunnel
may carry traffic to the origin, but a global Cloudflare Access policy would block
guest browsing. Keep the frontend/public allowlist reachable anonymously and keep
owner authorization in the application. Preserve HTTPS, the exact configured
origin, secure session cookies, existing headers and the deployment runbook.

There are no publication controls per entry: catalogue metadata and numeric
listening/ranking history are public as described above. Written journal content,
imports and administration remain private. Review this explicit publication
contract before any deployment; origin protection alone is not authorization.
