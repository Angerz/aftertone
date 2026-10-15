import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtistCatalogueControls, artistCatalogueSummary } from "./ArtistCatalogueControls";

describe("artist catalogue filter feedback", () => {
  it("identifies the default primary scope and ordering", () => {
    expect(artistCatalogueSummary("name", "asc", "primary", "")).toBe("Name, ascending · Primary");
  });
  it("describes custom sorting, featuring scope and search without repeating the search text", () => {
    expect(artistCatalogueSummary("rating", "asc", "featuring", "  Björk  ")).toBe("Average rating, ascending · Featuring only · Search results");
    expect(artistCatalogueSummary("projects", "desc", "all", "  ")).toBe("Project count, descending · All artists");
  });
  it("keeps an owner-only scope reached by URL visible in the summary", () => {
    expect(artistCatalogueSummary("name", "desc", "inactive", "")).toBe("Name, descending · Inactive");
  });
  it("connects the closed panel and exposes accessible direction and scope states", () => {
    const noop = () => undefined;
    const markup = renderToStaticMarkup(<ArtistCatalogueControls search="Björk" sort="rating" direction="desc" filter="all" onSearch={noop} onSort={noop} onDirection={noop} onFilter={noop} />);
    expect(markup).toContain('aria-expanded="false" aria-controls="artist-mobile-filters"');
    expect(markup).toContain('aria-label="Artist filters" hidden=""');
    expect(markup).toContain('aria-label="Descending" title="Descending" aria-pressed="true"');
    expect(markup).toContain("Average rating, descending · All artists · Search results");
  });
});
