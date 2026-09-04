import type { Album } from "../../api/types";

export type LibrarySort = "rating" | "year" | "artist" | "title" | "recent";

export function filterAndSortAlbums(albums: Album[], query: string, sort: LibrarySort): Album[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery ? albums.filter((album) => `${album.title} ${album.artist}`.toLocaleLowerCase().includes(normalizedQuery)) : albums;
  return [...filtered].sort((left, right) => {
    if (sort === "rating") return (right.latest_revision?.final_rating ?? -Infinity) - (left.latest_revision?.final_rating ?? -Infinity) || left.title.localeCompare(right.title);
    if (sort === "recent") return new Date(right.latest_revision?.created_at ?? 0).getTime() - new Date(left.latest_revision?.created_at ?? 0).getTime() || left.title.localeCompare(right.title);
    if (sort === "year") return (right.year ?? -Infinity) - (left.year ?? -Infinity) || left.title.localeCompare(right.title);
    return sort === "artist" ? left.artist.localeCompare(right.artist) || left.title.localeCompare(right.title) : left.title.localeCompare(right.title);
  });
}
