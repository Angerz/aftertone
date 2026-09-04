# 0008: Preserve unrated tracks as nullable historical scores

## Context

Reconciling an imported legacy rating can produce a real album tracklist with fewer extracted scores than tracks. Treating an unmapped track as `0` would fabricate a negative rating and alter the historical result.

## Decision

`track_rating_revisions.score` is nullable. `NULL` means the track was explicitly present in the revision snapshot but was not rated. Such rows set `include_in_pre_rating` to `false`; only mapped, non-null scores are given to the canonical rating calculator.

## Consequences

Revision detail views display an unrated track distinctly from `0.0`. Native rating entry remains complete and continues to require a score for every track.
