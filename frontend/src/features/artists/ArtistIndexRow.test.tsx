import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtistIndexRow } from "./ArtistPage";

describe("ArtistIndexRow", () => {
  it("renders a lazy artist portrait, project breakdown, tiered average, and navigation control", () => {
    const markup = renderToStaticMarkup(<ol><ArtistIndexRow artist={{ id: 1, name: "Björk", country_code: "IS", image_url: "/media/covers/fiona.webp", project_counts: { album: 2, mixtape: 1 }, average_rating: 7.9 }} onOpen={() => undefined} /></ol>);
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain("2 albums · 1 mixtape");
    expect(markup).toContain("rating-high");
    expect(markup).toContain('aria-label="Expand Björk"');
    expect(markup).toContain('class="artist-index-country-flag"');
    expect(markup).toContain('aria-label="Iceland"');
  });

  it("uses the existing initials fallback and neutral Not rated state, including inactive status", () => {
    const markup = renderToStaticMarkup(<ol><ArtistIndexRow artist={{ id: 2, name: "A$AP Rocky", image_url: null, is_active: false, project_counts: {}, average_rating: null }} onOpen={() => undefined} /></ol>);
    expect(markup).toContain("artist-image-placeholder");
    expect(markup).toContain(">AR<");
    expect(markup).toContain("No primary projects");
    expect(markup).toContain("Not rated");
    expect(markup).toContain("Inactive");
    expect(markup).not.toContain("artist-index-country-flag");
  });

  it("renders only compact primary-project data in an expanded row", () => {
    const markup = renderToStaticMarkup(<ol><ArtistIndexRow artist={{ id: 3, name: "Björk", project_counts: { album: 1 }, average_rating: 8 }} expanded onToggle={() => undefined} onOpen={() => undefined} detail={{ id: 3, name: "Björk", albums: [{ id: 11, title: "Vespertine", year: 2001, release_type: "album", cover_url: null, artists: [], rating: null }], featured_appearances: [{ track_id: 99, track_title: "Featured song" }] } as never} /></ol>);
    expect(markup).toContain("Projects");
    expect(markup).toContain("Vespertine");
    expect(markup).toContain("Not rated");
    expect(markup).toContain("View artist →");
    expect(markup).not.toContain("Featured song");
  });
});
