import { describe, expect, it } from "vitest";
import { libraryFilterSummary } from "./libraryFilterSummary";
import type { LibraryNavigation } from "./pagination";

const navigation: LibraryNavigation = { page: 1, sort: "rating", direction: "desc", revisit: false, unrated: false };

describe("collapsed Library filter summary", () => {
  it("makes an unfiltered catalogue and its ordering explicit", () => {
    expect(libraryFilterSummary(navigation)).toBe("Rating, descending · All albums");
  });

  it("keeps simultaneous status filters and custom ordering visible", () => {
    expect(libraryFilterSummary({ ...navigation, sort: "title", direction: "asc", revisit: true, unrated: true })).toBe("Title, ascending · Revisit · Not rated");
  });

  it("shows the selected year instead of repeating its decade", () => {
    expect(libraryFilterSummary({ ...navigation, decade: 2020, year: 2025 })).toBe("Rating, descending · 2025");
    expect(libraryFilterSummary({ ...navigation, decade: 2020 })).toBe("Rating, descending · 2020s");
  });

  it("retains the month filter reached from an album", () => {
    expect(libraryFilterSummary({ ...navigation, decade: 2020, year: 2025, month: 4 })).toBe("Rating, descending · April 2025");
  });

  it("distinguishes search results from an unfiltered catalogue", () => {
    expect(libraryFilterSummary({ ...navigation, search: "  Grace  " })).toBe("Rating, descending · Search results");
    expect(libraryFilterSummary({ ...navigation, search: "   " })).toBe("Rating, descending · All albums");
  });
});
