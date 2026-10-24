import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArtistTrack } from "../../api/types";
import { ArtistTrackRow } from "./ArtistTrackRow";

const track: ArtistTrack = { track_id: 7, title: "A track", disc_number: 2, track_position: 4, score: 0, album_id: 3, album_title: "An album", album_year: 2026, album_cover_url: null, primary_artists: [{ id: 1, name: "Lead" }, { id: 2, name: "Collaborator" }], featured_artists: [{ id: 3, name: "Guest" }] };

describe("shared artist track rows", () => {
  it("keeps collaborators linked, artwork fallback, metadata, zero scores and page numbering", () => {
    const markup = renderToStaticMarkup(<ol><ArtistTrackRow track={track} artistId={1} position={21} onAlbum={() => undefined} /></ol>);
    expect(markup).toContain('artist-top-track-rank">21</span>');
    expect(markup).toContain("with ");
    expect(markup).toContain("feat. ");
    expect(markup).toContain('href="/artists/2"');
    expect(markup).toContain('href="/artists/3"');
    expect(markup).toContain('title="Disc 2, track 4"');
    expect(markup).toContain('rating-low">0</b>');
    expect(markup).not.toContain("<img");
  });

  it("does not reserve an empty credit line for a solo primary artist", () => {
    const markup = renderToStaticMarkup(<ArtistTrackRow track={{ ...track, score: null, primary_artists: [track.primary_artists![0]], featured_artists: [] }} artistId={1} position={1} onAlbum={() => undefined} />);
    expect(markup).not.toContain("track-artist-credits");
    expect(markup).not.toContain("<small></small>");
    expect(markup).toContain("Unrated");
  });
});
