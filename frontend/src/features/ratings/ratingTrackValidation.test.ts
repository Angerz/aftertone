import { describe, expect, it } from "vitest";

import { scoreForRevision, trackScoreIsValid } from "./ratingTrackValidation";

describe("rating track validation", () => {
  it("accepts a blank score when the track is excluded from PRE", () => {
    expect(trackScoreIsValid(null, false)).toBe(true);
  });

  it("rejects a blank score when the track is included in PRE", () => {
    expect(trackScoreIsValid(null, true)).toBe(false);
  });

  it("keeps zero as a valid real score whether or not the track is included", () => {
    expect(trackScoreIsValid("0", true)).toBe(true);
    expect(trackScoreIsValid("0", false)).toBe(true);
    expect(scoreForRevision("0")).toBe(0);
  });

  it("makes a blank excluded track invalid immediately when it is included", () => {
    expect(trackScoreIsValid(null, false)).toBe(true);
    expect(trackScoreIsValid(null, true)).toBe(false);
  });

  it("keeps a numeric score valid when it is excluded", () => {
    expect(trackScoreIsValid("7.5", false)).toBe(true);
  });

  it("serializes a cleared excluded score as null, never zero", () => {
    expect(scoreForRevision(null)).toBeNull();
  });
});
