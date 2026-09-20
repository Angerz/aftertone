import type { ArtistAlbum } from "../../api/types";

export function toggleArtistExpansion(expanded: Set<number>, artistId: number): Set<number> {
  const next = new Set(expanded);
  next.has(artistId) ? next.delete(artistId) : next.add(artistId);
  return next;
}

export function previewArtistProjects(projects: ArtistAlbum[], limit = 5): ArtistAlbum[] {
  return projects.slice(0, limit);
}
