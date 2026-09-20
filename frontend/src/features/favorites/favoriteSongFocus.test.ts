import { expect, it } from "vitest";
import { clearFocusQuery, focusedFavoriteSongReturn, focusQuery, hasFreshFocusedFavoriteSong, viewForFocusedFavoriteSong } from "./favoriteSongFocus";

it("uses the updated canonical position to choose the focused view", () => {
  expect(viewForFocusedFavoriteSong({ global_position: 77 })).toBe("top");
  expect(viewForFocusedFavoriteSong({ global_position: 103 })).toBe("candidates");
  expect(viewForFocusedFavoriteSong({ global_position: 1 })).toBe("top");
});

it("returns by entry ID, clears a hiding search, and selects the updated panel", () => {
  expect(focusedFavoriteSongReturn({ id: 42, global_position: 103 })).toEqual({ entryId: 42, view: "candidates", search: "" });
  expect(focusedFavoriteSongReturn({ id: 42, global_position: 7 })).toEqual({ entryId: 42, view: "top", search: "" });
});

it("creates and removes a focus query by entry ID", () => {
  expect(focusQuery("?search=hidden", 42)).toBe("search=hidden&focus=42");
  expect(clearFocusQuery("?search=hidden&focus=42")).toBe("search=hidden");
});

it("waits for the post-save ranking generation before focusing an entry that moved within Top 100", () => {
  const stale = [{ id: 42, global_position: 20 }];
  const refreshed = [{ id: 42, global_position: 8 }];
  expect(hasFreshFocusedFavoriteSong({ entryId: 42, entries: stale, view: "top", loadedView: "top", loadedVersion: 4, requiredVersion: 5 })).toBe(false);
  expect(hasFreshFocusedFavoriteSong({ entryId: 42, entries: refreshed, view: "top", loadedView: "top", loadedVersion: 5, requiredVersion: 5 })).toBe(true);
});
