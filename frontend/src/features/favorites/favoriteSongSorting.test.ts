import { expect, it } from "vitest";
import { sortFavoriteSongs } from "./favoriteSongSorting";

const song = (id: number, title: string, position: number, overrides: Partial<Record<"final_score" | "emotional_connection" | "replay_value" | "base_score" | "originality", number>> = {}) => ({ id, track_title: title, global_position: position, final_score: 9, emotional_connection: 4, replay_value: 4, base_score: 8, originality: 4, ...overrides }) as never;

it("sorts display values while retaining canonical positions as tie breakers", () => {
  const entries = [song(1, "Zulu", 2, { replay_value: 5 }), song(2, "Alpha", 1, { replay_value: 5 }), song(3, "Beta", 3, { replay_value: 3 })];
  expect(sortFavoriteSongs(entries, "position").map((item) => item.id)).toEqual([2, 1, 3]);
  expect(sortFavoriteSongs(entries, "replay_value").map((item) => item.id)).toEqual([2, 1, 3]);
  expect(sortFavoriteSongs(entries, "title").map((item) => item.id)).toEqual([2, 3, 1]);
  expect(sortFavoriteSongs(entries, "replay_value").map((item) => item.global_position)).toEqual([1, 2, 3]);
});

it("sorts every numeric criterion descending", () => {
  const entries = [song(1, "A", 1, { final_score: 8, emotional_connection: 3, replay_value: 2, base_score: 6, originality: 1 }), song(2, "B", 2, { final_score: 9, emotional_connection: 4, replay_value: 3, base_score: 7, originality: 2 })];
  for (const sort of ["final_score", "emotional_connection", "replay_value", "base_score", "originality"] as const) {
    expect(sortFavoriteSongs(entries, sort).map((item) => item.id)).toEqual([2, 1]);
  }
});
