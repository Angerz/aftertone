import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtistIndexRow } from "./ArtistPage";

describe("ArtistIndexRow", () => {
  it("renders a lazy artist portrait, project breakdown, tiered average, and navigation control", () => {
    const markup = renderToStaticMarkup(<ol><ArtistIndexRow artist={{ id: 1, name: "Fiona Apple", image_url: "/media/covers/fiona.webp", project_counts: { album: 2, mixtape: 1 }, average_rating: 7.9 }} onOpen={() => undefined} /></ol>);
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain("2 albums · 1 mixtape");
    expect(markup).toContain("rating-high");
    expect(markup).toContain('aria-label="Open Fiona Apple"');
  });

  it("uses the existing initials fallback and neutral Not rated state, including inactive status", () => {
    const markup = renderToStaticMarkup(<ol><ArtistIndexRow artist={{ id: 2, name: "A$AP Rocky", image_url: null, is_active: false, project_counts: {}, average_rating: null }} onOpen={() => undefined} /></ol>);
    expect(markup).toContain("artist-image-placeholder");
    expect(markup).toContain(">AR<");
    expect(markup).toContain("No primary projects");
    expect(markup).toContain("Not rated");
    expect(markup).toContain("Inactive");
  });
});
