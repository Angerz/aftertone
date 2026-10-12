import { describe, expect, it } from "vitest";
import { buildAlbumQueryParams, getDecadeForYear, parseLibraryNavigation } from "./pagination";

describe("library pagination navigation", () => {
  it("parses and serializes shareable filters and direction", () => expect(parseLibraryNavigation(new URLSearchParams("page=2&decade=2020&year=2024&sort=year&direction=asc&search=grace&revisit=1&unrated=true"))).toEqual({ page: 2, decade: 2020, year: 2024, revisit: true, unrated: true, sort: "year", direction: "asc", search: "grace" }));
  it("uses sensible defaults while retaining legacy sort URLs", () => {
    expect(parseLibraryNavigation(new URLSearchParams("sort=recent"))).toMatchObject({ sort: "recent", direction: "desc" });
    expect(buildAlbumQueryParams({ page: 1, sort: "rating", direction: "desc", revisit: false, unrated: false }).toString()).toBe("");
  });
  it("persists an explicitly reversed direction with status toggles", () => expect(buildAlbumQueryParams({ page: 1, sort: "rating", direction: "asc", revisit: true, unrated: true }).toString()).toBe("revisit=1&unrated=1&direction=asc"));
  it("calculates decade boundaries", () => { expect(getDecadeForYear(2019)).toBe(2010); expect(getDecadeForYear(2020)).toBe(2020); expect(getDecadeForYear(2029)).toBe(2020); expect(getDecadeForYear(2030)).toBe(2030); });
});
