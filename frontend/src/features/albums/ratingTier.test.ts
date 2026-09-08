import { describe, expect, it } from "vitest";
import { getDisplayedRatingTier, getRatingTier } from "./ratingTier";

describe("getRatingTier", () => {
  it.each([
    [10, "high"],
    [7, "high"],
    [6.999, "mid"],
    [5, "mid"],
    [4.999, "low"],
    [0, "low"],
  ] as const)("maps %s to %s", (value, expected) => {
    expect(getRatingTier(value)).toBe(expected);
  });

  it("returns no tier for an unrated score", () => {
    expect(getRatingTier(null)).toBeNull();
  });

  it("uses the one-decimal Library display for album-card tiers", () => {
    expect(getDisplayedRatingTier(6.996)).toBe("high");
  });
});
