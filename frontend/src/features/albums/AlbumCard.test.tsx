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
    expect(markup).toContain('aria-label="Open Album, marked for revisit: listen again without hype."');
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
