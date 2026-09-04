# Client rating preview is non-authoritative

## Context

The rating editor needs immediate feedback while a listening session is being
written. Waiting for a request on every keystroke would make the local interface
needlessly sluggish. The persisted formula remains the backend's responsibility.

## Decision

Keep a small `ratingPreviewCalculator` in the frontend rating feature. It is
explicitly limited to in-memory display values, mirrors the backend calculator,
and is never used to populate a revision payload. A successful revision POST
replaces the displayed preview with its server-calculated response.

## Consequences

The UI remains responsive, while the snapshot and its scores remain authoritative
only after backend calculation. Formula changes require updating the isolated
preview alongside backend parity coverage.
