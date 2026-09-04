# Legacy spreadsheet ratings remain separate from revisions

## Context

The historical Excel workbook retains PRE formula operands but no reliable track
identity, position, or inclusion mapping. Treating those values as track rating
snapshots would fabricate history.

## Decision

Persist imported rows as `LegacyRating`, linked to an album but separate from
`RatingRevision`. Store extracted scores, source formula, source values and
calculator-derived audit values. Imported legacy albums may have no tracks.

## Consequences

Legacy values remain visible but are explicitly unreconciled. A future conscious
tracklist reconciliation may create a real revision; import never invents one.
