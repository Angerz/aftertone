import type { AlbumListParams } from "../../api/albums";
import { defaultLibrarySortDirection, type LibrarySort, type LibrarySortDirection } from "./library";

export type LibraryNavigation = Required<Pick<AlbumListParams, "page" | "sort" | "direction" | "revisit" | "unrated">> & Pick<AlbumListParams, "search" | "year" | "month" | "decade">;

export function getDecadeForYear(year: number): number { return Math.floor(year / 10) * 10; }
export function parseLibraryNavigation(params = new URLSearchParams(window.location.search)): LibraryNavigation {
  const number = (key: string) => { const value = Number(params.get(key)); return Number.isInteger(value) && value > 0 ? value : undefined; };
  const enabled = (key: string) => ["1", "true"].includes(params.get(key)?.toLowerCase() ?? "");
  const sort = params.get("sort"); const permitted: LibrarySort[] = ["rating", "recent", "year", "artist", "title"];
  const resolvedSort = permitted.includes(sort as LibrarySort) ? sort as LibrarySort : "rating";
  const rawDirection = params.get("direction"); const direction: LibrarySortDirection = rawDirection === "asc" || rawDirection === "desc" ? rawDirection : defaultLibrarySortDirection(resolvedSort);
  const year = number("year"); const rawMonth = number("month"); const month = year !== undefined && rawMonth !== undefined && rawMonth <= 12 ? rawMonth : undefined;
  return { page: number("page") ?? 1, search: params.get("search") || undefined, decade: number("decade"), year, month, revisit: enabled("revisit"), unrated: enabled("unrated"), sort: resolvedSort, direction };
}
export function buildAlbumQueryParams(navigation: LibraryNavigation): URLSearchParams {
  const params = new URLSearchParams();
  if (navigation.page > 1) params.set("page", String(navigation.page));
  if (navigation.search) params.set("search", navigation.search);
  if (navigation.decade) params.set("decade", String(navigation.decade));
  if (navigation.year) params.set("year", String(navigation.year));
  if (navigation.year && navigation.month) params.set("month", String(navigation.month));
  if (navigation.revisit) params.set("revisit", "1");
  if (navigation.unrated) params.set("unrated", "1");
  if (navigation.sort !== "rating") params.set("sort", navigation.sort);
  if (navigation.direction !== defaultLibrarySortDirection(navigation.sort)) params.set("direction", navigation.direction);
  return params;
}
