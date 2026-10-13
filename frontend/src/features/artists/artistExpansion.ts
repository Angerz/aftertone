import type { ArtistAlbum } from "../../api/types";
import { compareArtistProjects } from "./artistProjects";

export function toggleArtistExpansion(expanded: Set<number>, artistId: number): Set<number> {
  const next = new Set(expanded);
  next.has(artistId) ? next.delete(artistId) : next.add(artistId);
  return next;
}

function hasEffectiveRating(project: ArtistAlbum): boolean {
  return project.rating !== null && project.rating !== undefined;
}

export function compareArtistPreviewProjects(left: ArtistAlbum, right: ArtistAlbum): number {
  const ratingPriority = Number(hasEffectiveRating(right)) - Number(hasEffectiveRating(left));
  return ratingPriority || compareArtistProjects(left, right);
}

export function previewArtistProjects(projects: ArtistAlbum[], limit = 5): ArtistAlbum[] {
  return [...projects].sort(compareArtistPreviewProjects).slice(0, limit);
}
