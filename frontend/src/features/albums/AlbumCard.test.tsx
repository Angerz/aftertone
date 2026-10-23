import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Album } from "../../api/types";
import { AlbumCard } from "./AlbumCard";

const album = (overrides: Partial<Album> = {}): Album => ({ id: 1, title: "Album", artists: [{ id: 1, name: "Artist" }], year: 2020, release_type: "album", disc_count: 1, created_at: "2020-01-01", tracks: [], latest_revision: null, cover_url: null, needs_revisit: false, revisit_reason: null, revisit_marked_at: null, latest_legacy_rating: null, ...overrides });
const card = (value: Album) => renderToStaticMarkup(<AlbumCard album={value} onOpen={() => undefined} />);

describe("AlbumCard revisit indicator", () => {
  it("renders an accessible marker and reason for an album marked for revisit", () => {
    const markup = card(album({ needs_revisit: true, revisit_reason: "Listen again without hype." }));
    expect(markup).toContain('data-testid="revisit-indicator"');
    expect(markup).toContain("Revisit");
    expect(markup).toContain("Listen again without hype.");
    expect(markup).toContain('aria-label="Open Album by Artist, marked for revisit: listen again without hype."');
    expect(markup).toContain("<button");
  });

  it("does not render a marker or empty tooltip for an album without revisit state", () => {
    const markup = card(album());
    expect(markup).not.toContain('data-testid="revisit-indicator"');
    expect(markup).not.toContain('role="tooltip"');
  });

  it("uses the concise tooltip when revisit has no reason", () => {
    const markup = card(album({ needs_revisit: true }));
    expect(markup).toContain("Marked for revisit");
    expect(markup).not.toContain("<span></span>");
  });
});

describe("AlbumCard compact presentation", () => {
  it("keeps complete titles and every artist in the accessible navigation label", () => {
    const title = "Songs for the Places We Have Not Yet Learned to Leave";
    const markup = card(album({ title, artists: [{ id: 1, name: "The Orchestra of Extraordinary and Unexpectedly Long Artist Names" }, { id: 2, name: "Luna Sol" }] }));
    expect(markup).toContain(`aria-label="Open ${title} by The Orchestra of Extraordinary and Unexpectedly Long Artist Names &amp; Luna Sol"`);
  });

  it("distinguishes a zero rating from a project without a rating", () => {
    const zero = card(album({ latest_revision: { id: 1, created_at: "2026-01-01", pre_rating: 0, final_rating: 0 } }));
    expect(zero).toContain('data-rating-tier="low"');
    expect(zero).toContain('<b title="0.000">0</b>');
    expect(zero).not.toContain("Not rated");
    const unrated = card(album());
    expect(unrated).toContain('class="album-rating unrated"');
    expect(unrated).toContain('data-rating-tier="unrated"');
    expect(unrated).toContain("Not rated");
    expect(unrated).not.toContain('title="0.000"');
  });
});
