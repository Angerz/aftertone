import { describe, expect, it } from "vitest";
import { favoriteSongCriteria, validateFavoriteSongCriteria } from "./favoriteSongForm";

const valid = { base_score: "9.5", emotional_connection: "4", replay_value: "3", originality: "2" };

describe("favorite-song required criteria", () => {
  for (const [key, , max] of favoriteSongCriteria) {
    it.each(["", " ", "\t\n"])(`rejects a missing ${key} (%j) before conversion`, (missing) => {
      const result = validateFavoriteSongCriteria({ ...valid, [key]: missing });
      expect(result.values).toBeNull();
      expect(result.errors).toEqual({ [key]: "Enter a value." });
    });

    it(`accepts explicit zero and the upper bound for ${key}`, () => {
      expect(validateFavoriteSongCriteria({ ...valid, [key]: "0" }).values?.[key]).toBe(0);
      expect(validateFavoriteSongCriteria({ ...valid, [key]: String(max) }).values?.[key]).toBe(max);
    });

    it.each(["NaN", "Infinity", "-0.1", String(max + 0.1)])(`rejects invalid ${key} (%j)`, (invalid) => {
      expect(validateFavoriteSongCriteria({ ...valid, [key]: invalid }).values).toBeNull();
    });
  }

  it("preserves decimal input and allows an explicitly entered all-zero evaluation", () => {
    expect(validateFavoriteSongCriteria(valid).values).toEqual({ base_score: 9.5, emotional_connection: 4, replay_value: 3, originality: 2 });
    expect(validateFavoriteSongCriteria({ base_score: "0", emotional_connection: "0", replay_value: "0", originality: "0" })).toEqual({ errors: {}, values: { base_score: 0, emotional_connection: 0, replay_value: 0, originality: 0 } });
  });
});
