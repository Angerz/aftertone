# Track artist credits: audit and presentation

## Existing architecture and ambiguities

- `AlbumArtist` stores ordered album artists. `TrackArtist` stores ordered primary
  and featured relationships independently. Neither table stores join phrases,
  credited-as aliases, MusicBrainz artist IDs or performance roles.
- A track without explicit primary credits inherits the complete ordered album
  artist list. Explicit primary credits replace it; they never augment it implicitly.
  Featured credits do not affect this inheritance rule.
- Album responses already contain effective `primary_artists`, `featured_artists`
  and `uses_album_artists`. The previous Album Detail renderer ignored primaries.
- Track catalogue eligibility uses primary relationships and album inheritance.
  Featured appearances use featured relationships. Favorite Songs already resolves
  effective primaries. These queries determine ownership, not the display formatter.
- Revision snapshots do not store artist credits. Current catalogue attribution must
  not be backfilled into historical snapshots or presented as historical credits.
- The credit-write service rejects duplicate explicit artists within/across roles.
  An inherited primary artist can nevertheless also have a stored featured credit;
  presentation must deduplicate without modifying those records.
- MusicBrainz release import previously flattened every track artist into a primary
  name. Track/recording credits were read, but featuring join phrases were discarded.
  The separate Edit Album “Use MusicBrainz tracklist” path currently carries titles
  and discs only and replaces draft track identities. Retaining source credits there
  needs a coordinated editor/import workflow, not guessing IDs or mapping by title.
  This change leaves that editor workflow untouched and labels its limitation.

## Presentation contract

Compare unique artist IDs, not names or only the first album artist. Preserve credit
order when displaying names. Against the complete album artist set:

- Equal primaries: omit the redundant primary line.
- Strict superset: `with` followed by only the additional primary collaborators.
- Any other difference, including a subset of a multi-artist album: display every
  effective primary artist. Do not insert missing album artists.
- Append `feat.` with featured artists not already credited as effective primaries.
- Join multiple names with `&` (and commas for longer lists); separate primary and
  featured groups with ` · `. Track titles remain independent.

Artist track previews/catalogues use the current artist as the display context, so
additional collaborators remain visible. Standalone Favorite Songs attribution and
featured appearances show the full effective primary set plus guests. Row controls
must never contain nested interactive artist links: use non-interactive credit text
inside an existing row button, linked artists where the row structure permits it.

The track-number CSS selector is restricted to the number's header cell, rather
than all descendant spans (which otherwise made credit text look like bold ranks).
Album identity links wrap long/unbroken artist names without expanding the hero.
No eligibility, search, sorting, score or revision query semantics are changed.
Artist links reuse the existing SPA navigation callbacks, preserving the originating
catalogue URL and tab on Back. Changing artist ID remounts the detail view so an old
artist's selected tab/data cannot leak into the new artist's initial presentation.

Examples with album artist A (names remain independent of the track title):

| Effective primary | Featured | Secondary credit line |
| --- | --- | --- |
| A | None | No line |
| A, B | None | `with B` |
| A | C, D | `feat. C & D` |
| B | None | `B` |
| B, C | D | `B & C · feat. D` |
| A, B | C, D | `with B · feat. C & D` |

For an album credited to A and B, a track credited only to A displays `A`, not
an empty line or an invented B. A track credited to A and C displays `A & C`.

## MusicBrainz boundary

[MusicBrainz artist credits](https://musicbrainz.org/doc/Artist_Credits) contain ordered
artists, optional credited names and joins. Recognize explicit `feat.`, `ft.` and
`featuring` joins as the start of the featured group; keep ambiguous joins such as
`with`, `&` or `vs.` as primary collaborations. Never parse artist names or titles.
Track-level credits take precedence over recording credits; missing track credits
fall back to the recording and then to album inheritance.

The import contract carries primary/featured names separately, with empty defaults
for older callers. A track with featured credits and album-equivalent primaries
still inherits the album primaries; its featured relationships are persisted.

Arbitrary source join phrases, aliases, distinct artists sharing a normalized name,
performer/composer/conductor roles and role switches within complex credits cannot
be reproduced losslessly by the current schema. They are not inferred or encoded
into artist names. No schema migration or automatic rewrite of existing data is part
of this work. Imported projects can be reviewed with the existing credit editor.

## Implementation and verification

- `backend/app/services/artists.py` resolves effective ordered credits;
  `main.py` reuses it for albums, artist tracks/appearances and Favorite Songs.
  Additive response fields expose both roles without changing ownership queries.
  Artist summaries eagerly load credit relationships rather than querying per row.
- `backend/app/integrations/musicbrainz.py` and the import schemas/endpoint retain
  explicit featured roles in new release imports. Older request payloads still work.
- `frontend/src/features/artists/trackArtistCredits.ts` is the shared display
  formatter; `TrackArtistCredits.tsx` provides linked or non-interactive rendering.
  `AlbumTrackList` and `ArtistTrackRow` keep row structure, disc/position and scores.
  Top tracks and the full catalogue reuse the same row component. Favorite Songs
  and featured appearances reuse formatting without nesting links in row buttons.
- The Edit Album page, Library, branding, model definitions and migrations are
  unchanged. Its separate MusicBrainz enrichment component now warns and confirms
  the existing titles/discs-only replacement; it does not claim to import credits.
- Focused verification: 52 backend credit/import/artist/Favorite tests, 8 public-read
  security tests and 3 snapshot/validation regressions passed. All use synthetic
  in-memory or worktree-local test databases, never the personal database.
- Frontend: 44 focused tests passed; TypeScript lint and production build passed.
  Ruff lint/format and `git diff --check` passed.
- A browser smoke check with every API response mocked covered the example cases,
  complete multi-artist sets, compilations/soundtracks, artwork fallbacks, long and
  unbroken names, zero scores, disc grouping, page-2 numbering, keyboard artist
  links and cancellation of tracklist replacement. At 390, 768 and 1440px, no
  horizontal page overflow or track title/score overlap was found. Screenshots
  were visually inspected. No live MusicBrainz or personal API data was used.
