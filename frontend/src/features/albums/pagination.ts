import type { AlbumListParams } from "../../api/albums";
import type { LibrarySort } from "./library";

export type LibraryNavigation = Required<Pick<AlbumListParams, "page" | "sort">> & Pick<AlbumListParams, "search" | "year" | "decade">;

export function getDecadeForYear(year: number): number { return Math.floor(year / 10) * 10; }
export function parseLibraryNavigation(params = new URLSearchParams(window.location.search)): LibraryNavigation {
  const number = (key: string) => { const value = Number(params.get(key)); return Number.isInteger(value) && value > 0 ? value : undefined; };
  const sort = params.get("sort"); const permitted: LibrarySort[] = ["rating", "recent", "year", "artist", "title"];
  return { page: number("page") ?? 1, search: params.get("search") || undefined, decade: number("decade"), year: number("year"), sort: permitted.includes(sort as LibrarySort) ? sort as LibrarySort : "rating" };
}
export function buildAlbumQueryParams(navigation: LibraryNavigation): URLSearchParams {
  const params = new URLSearchParams();
  if (navigation.page > 1) params.set("page", String(navigation.page));
  if (navigation.search) params.set("search", navigation.search);
  if (navigation.decade) params.set("decade", String(navigation.decade));
  if (navigation.year) params.set("year", String(navigation.year));
  if (navigation.sort !== "rating") params.set("sort", navigation.sort);
  return params;
}
