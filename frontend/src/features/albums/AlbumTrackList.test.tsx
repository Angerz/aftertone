import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Album, RatingRevisionDetail, Track } from "../../api/types";
import { AlbumTrackList } from "./AlbumTrackList";

const a = { id: 1, name: "Album artist" };
const b = { id: 2, name: "Other artist with an exceptionally long credited name" };
const c = { id: 3, name: "Featured guest" };
const tracks: Track[] = [
  { id: 1, disc_number: 1, position: 1, title: "Inherited", uses_album_artists: true, primary_artists: [a], featured_artists: [] },
  { id: 2, disc_number: 1, position: 2, title: "Collaboration", uses_album_artists: false, primary_artists: [a, b], featured_artists: [c] },
  { id: 3, disc_number: 2, position: 1, title: "Independent track title", uses_album_artists: false, primary_artists: [b], featured_artists: [c] },
];
const album: Album = { id: 1, title: "Soundtrack", artists: [a], year: 2026, release_type: "soundtrack", disc_count: 2, tracks, cover_url: null, latest_revision: null, latest_legacy_rating: null, needs_revisit: false, revisit_reason: null, revisit_marked_at: null };
const render = (value = album, revision: RatingRevisionDetail | null = null) => renderToStaticMarkup(<AlbumTrackList album={value} revision={revision} pendingLegacy={false} onArtist={() => undefined} />);

describe("Album Detail tracklist", () => {
  it("renders effective primaries and featured credits without changing titles, discs or scores", () => {
    const markup = render();
    expect(markup).toContain("Disc 1");
    expect(markup).toContain("Disc 2");
    expect(markup).toContain("with ");
    expect(markup.match(/feat\./g)).toHaveLength(2);
    expect(markup.match(/class="track-features"/g)).toHaveLength(2);
    expect(markup).toContain("<strong>Independent track title</strong>");
    expect(markup).not.toContain("Independent track title feat.");
    expect(markup).toContain('href="/artists/2"');
    expect(markup).not.toContain('href="/artists/1"');
  });

  it("also renders explicit attribution on Various Artists compilations without artwork", () => {
    const markup = render({ ...album, release_type: "compilation", artists: [{ id: 99, name: "Various Artists" }] });
    expect(markup).toContain(b.name);
    expect(markup).not.toContain('href="/artists/99"');
    expect(markup).not.toContain("<img");
  });

  it("preserves zero scores, notes and PRE exclusion from the revision", () => {
    const revision: RatingRevisionDetail = { id: 4, album_id: 1, created_at: "2026-10-23", pre_rating: null, coherence: 5, coherence_notes: null, emotion: 5, emotion_notes: null, album_notes: null, bad_experience: null, final_rating: null, rating_breakdown: { pre_contribution: null, coherence_contribution: null, bad_experience_contribution: null, emotion_contribution: null, final_rating: null }, tracks: [{ track_id: 2, title: "Historical title", disc_number: 1, position: 2, score: 0, include_in_pre_rating: false, notes: "A preserved thought." }] };
    const markup = render(album, revision);
    expect(markup).toContain('class="track-score rating-low">0.0</b>');
    expect(markup).toContain("Excluded from PRE");
    expect(markup).toContain("A preserved thought.");
    expect(revision.tracks[0].title).toBe("Historical title");
    expect(revision.tracks[0].score).toBe(0);
  });
});
