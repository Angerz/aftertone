import { describe, expect, it } from "vitest";
import { buildAlbumQueryParams, getDecadeForYear, parseLibraryNavigation } from "./pagination";

describe("library pagination navigation", () => {
  it("parses and serializes shareable filters", () => expect(parseLibraryNavigation(new URLSearchParams("page=2&decade=2020&year=2024&sort=year&search=grace"))).toEqual({ page: 2, decade: 2020, year: 2024, sort: "year", search: "grace" }));
  it("omits default query params", () => expect(buildAlbumQueryParams({ page: 1, sort: "rating" }).toString()).toBe(""));
  it("calculates decade boundaries", () => { expect(getDecadeForYear(2019)).toBe(2010); expect(getDecadeForYear(2020)).toBe(2020); expect(getDecadeForYear(2029)).toBe(2020); expect(getDecadeForYear(2030)).toBe(2030); });
});
