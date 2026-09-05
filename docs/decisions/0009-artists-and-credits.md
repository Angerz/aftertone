# Artists and credits are catalogue relationships

## Context

An album's former free-text artist field could not represent collaborations or
track guests consistently, and made artist navigation impossible.

## Decision

`Artist` is a canonical entity keyed by a whitespace-normalized, case-folded
name. Albums connect to artists through ordered `AlbumArtist` credits. Tracks
may have ordered primary and featured `TrackArtist` credits.

A track with no explicit primary credits inherits the ordered artists of its
album. Featured credits are separate metadata and are rendered as `feat.`;
they are never added to the track title. Existing legacy album artist strings
are migrated whole into one provisional Artist rather than guessed apart.

## Consequences

Current catalogue metadata can evolve independently of immutable rating
revisions. The API exposes artist arrays and routes for artist catalogue
navigation, while the rating calculator remains unchanged.
