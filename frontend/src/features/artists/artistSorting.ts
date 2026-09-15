import type { ArtistListSort } from "../../api/artists";
import type { ArtistFilter } from "./artistMaintenance";

export const artistSortOptions: { value: ArtistListSort; label: string }[] = [
  { value: "name", label: "Name — A to Z" },
  { value: "rating", label: "Rating — highest first" },
  { value: "projects", label: "Projects — most first" },
];

export function parseArtistSort(params = new URLSearchParams(window.location.search)): ArtistListSort {
  const sort = params.get("sort");
  return sort === "rating" || sort === "projects" ? sort : "name";
}

export function buildArtistSortQuery(sort: ArtistListSort): URLSearchParams {
  const params = new URLSearchParams();
  if (sort !== "name") params.set("sort", sort);
  return params;
}

export function parseArtistFilter(params = new URLSearchParams(window.location.search)): ArtistFilter {
  const filter = params.get("filter");
  return filter === "primary" || filter === "featuring" || filter === "active" || filter === "inactive" || filter === "unused" ? filter : "all";
}

export function buildArtistCatalogueQuery(sort: ArtistListSort, filter: ArtistFilter): URLSearchParams {
  const params = buildArtistSortQuery(sort);
  if (filter !== "all") params.set("filter", filter);
  return params;
}
