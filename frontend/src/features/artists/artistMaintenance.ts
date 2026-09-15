import type { Artist } from "../../api/types";
import type { ArtistScope } from "../../api/artists";

export type ArtistFilter = "all" | "primary" | "featuring" | "active" | "inactive" | "unused";

export function artistFilterParams(filter: ArtistFilter): { active?: boolean; unused?: boolean; scope?: ArtistScope } {
  return filter === "primary" ? { scope: "primary" } : filter === "featuring" ? { scope: "featuring" } : filter === "active" ? { active: true } : filter === "inactive" ? { active: false } : filter === "unused" ? { unused: true } : {};
}

export function canDeleteArtist(artist: Artist): boolean {
  return artist.is_unused === true;
}

export function pickerArtistParams(search: string) {
  return { search, page: 1, page_size: 12, active: true };
}
