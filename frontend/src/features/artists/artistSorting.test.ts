import { describe, expect, it } from "vitest";
import { artistSortOptions, buildArtistCatalogueQuery, buildArtistSortQuery, parseArtistFilter, parseArtistSort } from "./artistSorting";

describe("artist sorting navigation", () => {
  it("offers Name as the default alongside Rating and Projects", () => {
    expect(artistSortOptions.map((option) => option.value)).toEqual(["name", "rating", "projects"]);
    expect(parseArtistSort(new URLSearchParams())).toBe("name");
  });

  it("restores a supported sort from the URL and rejects unknown values", () => {
    expect(parseArtistSort(new URLSearchParams("sort=rating"))).toBe("rating");
    expect(parseArtistSort(new URLSearchParams("sort=projects"))).toBe("projects");
    expect(parseArtistSort(new URLSearchParams("sort=unknown"))).toBe("name");
  });

  it("omits the default sort and serializes non-default choices", () => {
    expect(buildArtistSortQuery("name").toString()).toBe("");
    expect(buildArtistSortQuery("rating").toString()).toBe("sort=rating");
    expect(buildArtistSortQuery("projects").toString()).toBe("sort=projects");
  });

  it("restores and serializes catalogue filters alongside sorting", () => {
    expect(parseArtistFilter(new URLSearchParams("filter=primary"))).toBe("primary");
    expect(parseArtistFilter(new URLSearchParams("filter=featuring"))).toBe("featuring");
    expect(parseArtistFilter(new URLSearchParams("filter=invalid"))).toBe("all");
    expect(buildArtistCatalogueQuery("projects", "primary").toString()).toBe("sort=projects&filter=primary");
  });
});
