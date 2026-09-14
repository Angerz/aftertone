import type { ArtistListSort } from "../../api/artists";

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
