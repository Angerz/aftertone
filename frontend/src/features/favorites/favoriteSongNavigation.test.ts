import { describe, expect, it } from "vitest";
import { clearFocusQuery, focusedFavoriteSongReturn, focusQuery } from "./favoriteSongFocus";
import { favoriteSongViewQuery, parseFavoriteSongView } from "./favoriteSongNavigation";

describe("favorite-song URL navigation", () => {
  it.each(["", "?view=top", "?view=unknown", "?view=", "?view=Candidates"])("defaults safely to Top 100 for %j", (search) => {
    expect(parseFavoriteSongView(search)).toBe("top");
  });

  it("restores Candidates and preserves unrelated and focus parameters", () => {
    expect(parseFavoriteSongView("?focus=42&view=candidates")).toBe("candidates");
    expect(favoriteSongViewQuery("?focus=42&other=kept", "candidates")).toBe("focus=42&other=kept&view=candidates");
    expect(favoriteSongViewQuery("?view=candidates&other=kept", "top")).toBe("other=kept");
  });

  it("keeps the URL and canonical post-edit view aligned on either side of position 100", () => {
    for (const position of [1, 100, 101, 125]) {
      const focus = focusedFavoriteSongReturn({ id: 42, global_position: position });
      const query = focusQuery(favoriteSongViewQuery("?view=candidates&other=kept", focus.view), focus.entryId);
      expect(parseFavoriteSongView(query)).toBe(focus.view);
      expect(new URLSearchParams(query).get("focus")).toBe("42");
      expect(parseFavoriteSongView(clearFocusQuery(query))).toBe(focus.view);
      expect(new URLSearchParams(clearFocusQuery(query)).get("other")).toBe("kept");
    }
  });
});
