import { expect, it } from "vitest";
import { favoriteSongScore } from "./favoriteSongCalculator";
it("matches the canonical favorite-song formula", () => expect(favoriteSongScore(10, 5, 5, 4.7, 5)).toBeCloseTo(9.97));
