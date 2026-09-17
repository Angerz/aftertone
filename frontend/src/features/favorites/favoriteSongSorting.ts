import type { FavoriteSongEntry } from "../../api/types";

export type FavoriteSongSort = "position" | "final_score" | "emotional_connection" | "replay_value" | "base_score" | "originality" | "title";

export function sortFavoriteSongs(entries: FavoriteSongEntry[], sort: FavoriteSongSort): FavoriteSongEntry[] {
  return [...entries].sort((left, right) => {
    if (sort === "position") return left.global_position - right.global_position;
    if (sort === "title") return left.track_title.localeCompare(right.track_title) || left.global_position - right.global_position;
    return right[sort] - left[sort] || left.global_position - right.global_position;
  });
}
