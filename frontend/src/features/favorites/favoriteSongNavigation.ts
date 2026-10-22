import type { FavoriteSongView } from "./favoriteSongFocus";

export function parseFavoriteSongView(search: string): FavoriteSongView {
  return new URLSearchParams(search).get("view") === "candidates" ? "candidates" : "top";
}

export function favoriteSongViewQuery(search: string, view: FavoriteSongView): string {
  const params = new URLSearchParams(search);
  if (view === "candidates") params.set("view", view);
  else params.delete("view");
  return params.toString();
}
