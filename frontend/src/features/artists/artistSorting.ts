import type { ArtistListSort, ArtistSortDirection } from "../../api/artists";
import type { ArtistFilter } from "./artistMaintenance";

export const artistSortOptions: { value: ArtistListSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "rating", label: "Average rating" },
  { value: "projects", label: "Project count" },
];

export function defaultArtistSortDirection(sort: ArtistListSort): ArtistSortDirection {
  return sort === "name" ? "asc" : "desc";
}

export function parseArtistSort(params = new URLSearchParams(window.location.search)): ArtistListSort {
  const sort = params.get("sort");
  return sort === "rating" || sort === "projects" ? sort : "name";
}

export function parseArtistSortDirection(params = new URLSearchParams(window.location.search), sort = parseArtistSort(params)): ArtistSortDirection {
  const direction = params.get("direction");
  return direction === "asc" || direction === "desc" ? direction : defaultArtistSortDirection(sort);
}

export function parseArtistFilter(params = new URLSearchParams(window.location.search)): ArtistFilter {
  const filter = params.get("filter");
  return filter === "all" || filter === "featuring" || filter === "active" || filter === "inactive" || filter === "unused" ? filter : "primary";
}

export function parseArtistSearch(params = new URLSearchParams(window.location.search)): string {
  return params.get("search") ?? "";
}

export function parseArtistPage(params = new URLSearchParams(window.location.search)): number {
  const page = Number(params.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function buildArtistCatalogueQuery({ sort, direction, filter, search = "", page = 1 }: { sort: ArtistListSort; direction: ArtistSortDirection; filter: ArtistFilter; search?: string; page?: number }): URLSearchParams {
  const params = new URLSearchParams({ sort, direction, filter });
  if (search.trim()) params.set("search", search.trim());
  if (page > 1) params.set("page", String(page));
  return params;
}
