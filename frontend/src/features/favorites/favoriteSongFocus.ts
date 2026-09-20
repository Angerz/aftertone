import type { FavoriteSongEntry } from "../../api/types";

export type FavoriteSongView = "top" | "candidates";

export function viewForFocusedFavoriteSong(entry: Pick<FavoriteSongEntry, "global_position">): FavoriteSongView {
  return entry.global_position <= 100 ? "top" : "candidates";
}

export function focusedFavoriteSongReturn(entry: Pick<FavoriteSongEntry, "id" | "global_position">): { entryId: number; view: FavoriteSongView; search: "" } {
  return { entryId: entry.id, view: viewForFocusedFavoriteSong(entry), search: "" };
}

export function focusQuery(search: string, entryId: number): string {
  const params = new URLSearchParams(search);
  params.set("focus", String(entryId));
  return params.toString();
}

export function clearFocusQuery(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("focus");
  return params.toString();
}

export function hasFreshFocusedFavoriteSong({ entryId, entries, view, loadedView, loadedVersion, requiredVersion }: { entryId: number; entries: Pick<FavoriteSongEntry, "id">[]; view: FavoriteSongView; loadedView: FavoriteSongView | null; loadedVersion: number | null; requiredVersion: number | null }): boolean {
  return loadedView === view && (requiredVersion === null || loadedVersion === requiredVersion) && entries.some((entry) => entry.id === entryId);
}
