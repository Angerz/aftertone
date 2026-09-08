import { describe, expect, it } from "vitest";
import { getLibraryRatingMeter } from "./LibraryRatingBar";

describe("getLibraryRatingMeter", () => {
  it.each([
    [10.202, { percent: 100, tier: "high" }],
    [10, { percent: 100, tier: "high" }],
    [9.9, { percent: 99, tier: "high" }],
    [7.1, { percent: 71, tier: "high" }],
    [7, { percent: 70, tier: "high" }],
    [6.996, { percent: 69.96, tier: "high" }],
    [6.999, { percent: 69.99, tier: "high" }],
    [6.9, { percent: 69, tier: "mid" }],
    [5, { percent: 50, tier: "mid" }],
    [4.999, { percent: 49.99, tier: "mid" }],
    [4.9, { percent: 49, tier: "low" }],
    [0, { percent: 0, tier: "low" }],
  ])("maps %s to %o", (value, expected) => {
    expect(getLibraryRatingMeter(value)).toEqual(expected);
  });

  it("returns no meter for an unrated album", () => {
    expect(getLibraryRatingMeter(null)).toBeNull();
  });
});
