import { describe, expect, it } from "vitest";

import { ratingPreviewCalculator, type PreviewTrack } from "./ratingPreviewCalculator";

const included = (scores: number[]): PreviewTrack[] => scores.map((score) => ({ score, includeInPreRating: true }));
const coherenceComponent = (preview: ReturnType<typeof ratingPreviewCalculator>) => {
  if (preview.preRating === null || preview.badExperience === null || preview.emotionComponent === null || preview.finalRating === null) return null;
  return preview.finalRating - preview.preRating + 0.5 * preview.badExperience ** 2 - preview.emotionComponent;
};

describe("ratingPreviewCalculator backend parity", () => {
  it("matches the known Grace calculation", () => {
    const preview = ratingPreviewCalculator(included([10, 10, 10, 10, 10, 10, 10, 10, 9.5, 10, 10]), 7, 10);
    expect(preview.preRating).toBeCloseTo(9.954545455, 8);
    expect(preview.badExperience).toBe(0);
    expect(coherenceComponent(preview)).toBeCloseTo(0.1225, 10);
    expect(preview.emotionComponent).toBe(0.125);
    expect(preview.finalRating).toBeCloseTo(10.202045455, 8);
  });

  it("matches the known To Pimp a Butterfly calculation", () => {
    const preview = ratingPreviewCalculator(included([10, 10, 10, 9.9, 10, 10, 9.9, 9.6, 9.7, 9.8, 10, 9.6, 10, 9.6, 9.7, 10]), 10, 8.5);
    expect(preview.preRating).toBeCloseTo(9.8625, 10);
    expect(preview.badExperience).toBe(0);
    expect(coherenceComponent(preview)).toBeCloseTo(0.25, 10);
    expect(preview.emotionComponent).toBeCloseTo(0.0875, 10);
    expect(preview.finalRating).toBeCloseTo(10.2, 10);
  });

  it("assigns bad-experience points below 5 and below 7", () => {
    const preview = ratingPreviewCalculator(included([8, 6, 4]), 0, 5);
    expect(preview.preRating).toBe(6);
    expect(preview.badExperience).toBe(0.5);
    expect(preview.emotionComponent).toBe(0);
    expect(preview.finalRating).toBeCloseTo(5.875, 10);
  });

  it("treats a score of 5 as a half bad-experience point", () => {
    expect(ratingPreviewCalculator(included([5]), 0, 5).badExperience).toBe(0.5);
  });

  it("treats a score of 7 as no bad-experience point", () => {
    expect(ratingPreviewCalculator(included([7]), 0, 5).badExperience).toBe(0);
  });

  it("does not attenuate a negative emotional penalty when experience is bad", () => {
    const clean = ratingPreviewCalculator(included([10]), 0, 3);
    const bad = ratingPreviewCalculator(included([0]), 0, 3);
    expect(clean.emotionComponent).toBe(-0.05);
    expect(bad.emotionComponent).toBe(-0.05);
  });

  it("attenuates a positive emotional bonus when experience is bad", () => {
    const clean = ratingPreviewCalculator(included([10]), 0, 10);
    const bad = ratingPreviewCalculator(included([0]), 0, 10);
    expect(clean.emotionComponent).toBe(0.125);
    expect(bad.emotionComponent).toBe(0);
  });

  it("has no emotional component at emotion 5", () => {
    expect(ratingPreviewCalculator(included([8]), 0, 5).emotionComponent).toBe(0);
  });

  it("returns null ratings when no track is included", () => {
    const preview = ratingPreviewCalculator([{ score: 10, includeInPreRating: false }, { score: 1, includeInPreRating: false }], 7, 10);
    expect(preview).toEqual({ preRating: null, badExperience: null, emotionComponent: null, finalRating: null });
  });

  it("ignores excluded tracks in PRE and bad experience", () => {
    const preview = ratingPreviewCalculator([{ score: 10, includeInPreRating: true }, { score: 1, includeInPreRating: false }], 0, 5);
    expect(preview.preRating).toBe(10);
    expect(preview.badExperience).toBe(0);
    expect(preview.finalRating).toBe(10);
  });
});
