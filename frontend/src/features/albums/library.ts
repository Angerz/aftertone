import type { Album } from "../../api/types";
import { formatArtistNames } from "../artists/artistDisplay";

export type LibrarySort = "rating" | "year" | "artist" | "title" | "recent";

export function filterAndSortAlbums(albums: Album[], query: string, sort: LibrarySort): Album[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery ? albums.filter((album) => `${album.title} ${formatArtistNames(album.artists)}`.toLocaleLowerCase().includes(normalizedQuery)) : albums;
  return [...filtered].sort((left, right) => {
    if (sort === "rating") return (right.latest_revision?.final_rating ?? -Infinity) - (left.latest_revision?.final_rating ?? -Infinity) || left.title.localeCompare(right.title);
    if (sort === "recent") return new Date(right.latest_revision?.created_at ?? 0).getTime() - new Date(left.latest_revision?.created_at ?? 0).getTime() || left.title.localeCompare(right.title);
    if (sort === "year") return (right.year ?? -Infinity) - (left.year ?? -Infinity) || left.title.localeCompare(right.title);
    return sort === "artist" ? formatArtistNames(left.artists).localeCompare(formatArtistNames(right.artists)) || left.title.localeCompare(right.title) : left.title.localeCompare(right.title);
  });
}
