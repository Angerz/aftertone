import { describe, expect, it } from "vitest";

import { scoreForRevision, shouldShowTrackScoreError, trackScoreIsValid } from "./ratingTrackValidation";

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
    expect(scoreForRevision("7.5")).toBe(7.5);
  });

  it("serializes a cleared excluded score as null, never zero", () => {
    expect(scoreForRevision(null)).toBeNull();
  });

  it("defers invalid-score feedback until a track is touched or submission is attempted", () => {
    expect(shouldShowTrackScoreError(null, true, false, false)).toBe(false);
    expect(shouldShowTrackScoreError(null, true, true, false)).toBe(true);
    expect(shouldShowTrackScoreError(null, true, false, true)).toBe(true);
    expect(shouldShowTrackScoreError("0", true, true, true)).toBe(false);
  });
});
