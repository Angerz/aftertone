# Rating revisions are snapshots

## Context

Album opinions and track scores change over time. Older evaluations must remain explainable even if the current track list or notes later change.

## Options considered

- Store one mutable score and overwrite it.
- Version every album catalogue field.
- Keep mutable catalogue tracks plus immutable rating snapshots.

## Decision

`Album` and `Track` represent the current catalogue. Each evaluation creates a `RatingRevision`, with `TrackRatingRevision` children that snapshot each track's title, position, score, inclusion flag, and notes. The revision also stores subjective inputs, written notes, and calculated results.

## Consequences

History is readable without consulting mutable current scores. A track link is retained for traceability, while its display identity is copied into the snapshot. Creating a revision, rather than editing an existing one, is the normal reassessment operation.

