import { expect, it } from "vitest";
import { favoriteSongScore, favoriteSongWeights } from "./favoriteSongCalculator";
it("matches the canonical favorite-song formula", () => expect(favoriteSongScore(10, 5, 5, 5)).toBeCloseTo(10));

it("explains each contribution using the canonical coefficients", () => {
  const values = { base_score: 9, emotional_connection: 4, replay_value: 4, originality: 3 };
  const contributions = Object.entries(values).map(([key, value]) => value * favoriteSongWeights[key as keyof typeof favoriteSongWeights]);
  [2.25, 4.4, 1.2, .3].forEach((expected, index) => expect(contributions[index]).toBeCloseTo(expected));
  expect(contributions.reduce((total, value) => total + value, 0)).toBeCloseTo(8.15);
  expect(favoriteSongScore(9, 4, 4, 3)).toBeCloseTo(8.15);
});
