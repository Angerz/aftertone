import { describe, expect, it } from "vitest";
import { artistSortOptions, buildArtistCatalogueQuery, defaultArtistSortDirection, parseArtistFilter, parseArtistPage, parseArtistSearch, parseArtistSort, parseArtistSortDirection } from "./artistSorting";

describe("artist sorting navigation", () => {
  it("offers separate fields and sensible default directions", () => {
    expect(artistSortOptions.map((option) => option.value)).toEqual(["name", "rating", "projects"]);
    expect(parseArtistSort(new URLSearchParams())).toBe("name");
    expect(defaultArtistSortDirection("name")).toBe("asc");
    expect(defaultArtistSortDirection("rating")).toBe("desc");
    expect(defaultArtistSortDirection("projects")).toBe("desc");
  });

  it("restores a supported sort from the URL and rejects unknown values", () => {
    expect(parseArtistSort(new URLSearchParams("sort=rating"))).toBe("rating");
    expect(parseArtistSortDirection(new URLSearchParams("sort=rating"))).toBe("desc");
    expect(parseArtistSortDirection(new URLSearchParams("sort=rating&direction=asc"))).toBe("asc");
    expect(parseArtistSort(new URLSearchParams("sort=projects"))).toBe("projects");
    expect(parseArtistSort(new URLSearchParams("sort=unknown"))).toBe("name");
  });

  it("defaults to Primary only without a URL filter and preserves explicit URL state", () => {
    expect(parseArtistFilter(new URLSearchParams())).toBe("primary");
    expect(parseArtistFilter(new URLSearchParams("filter=primary"))).toBe("primary");
    expect(parseArtistFilter(new URLSearchParams("filter=all"))).toBe("all");
    expect(parseArtistFilter(new URLSearchParams("filter=featuring"))).toBe("featuring");
    expect(parseArtistFilter(new URLSearchParams("filter=invalid"))).toBe("primary");
    const params = new URLSearchParams("sort=projects&direction=asc&filter=all&search=zoe&page=3");
    expect(parseArtistSearch(params)).toBe("zoe");
    expect(parseArtistPage(params)).toBe(3);
    expect(buildArtistCatalogueQuery({ sort: "projects", direction: "asc", filter: "all", search: "zoe", page: 3 }).toString()).toBe("sort=projects&direction=asc&filter=all&search=zoe&page=3");
  });
});
