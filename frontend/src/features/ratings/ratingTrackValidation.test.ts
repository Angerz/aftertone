import { describe, expect, it } from "vitest";

import { ratingScoreErrorMessage, scoreForRevision, shouldShowTrackScoreError, trackScoreIsValid } from "./ratingTrackValidation";

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

  it("distinguishes missing scores from invalid numeric values", () => {
    expect(ratingScoreErrorMessage(null)).toBe("A score is required.");
    expect(ratingScoreErrorMessage("")).toBe("A score is required.");
    for (const score of ["-0.1", "10.1", "NaN"]) {
      expect(ratingScoreErrorMessage(score)).toBe("Enter a number from 0 to 10.");
    }
    for (const score of ["0", "7.5", "10"]) expect(ratingScoreErrorMessage(score)).toBeNull();
  });

  it("requires an excluded score to be corrected only when a value is present and invalid", () => {
    expect(shouldShowTrackScoreError(null, false, false, true)).toBe(false);
    expect(shouldShowTrackScoreError("11", false, false, true)).toBe(true);
    expect(shouldShowTrackScoreError("0", false, false, true)).toBe(false);
  });
});
