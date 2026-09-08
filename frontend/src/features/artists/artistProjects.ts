import type { ArtistAlbum, ArtistDetail, ReleaseType } from "../../api/types";

const releaseTypeLabels: Record<ReleaseType, string> = {
  album: "Albums",
  ep: "EPs",
  mixtape: "Mixtapes",
  compilation: "Compilations",
};

const releaseTypeOrder: ReleaseType[] = ["album", "ep", "mixtape", "compilation"];

export interface ArtistProjectGroup {
  releaseType: ReleaseType;
  label: string;
  projects: ArtistAlbum[];
}

export function averageProjectRating(projects: ArtistAlbum[]): number | null {
  const rated = projects.map((project) => project.rating).filter((rating): rating is number => rating !== null);
  return rated.length ? rated.reduce((total, rating) => total + rating, 0) / rated.length : null;
}

export function ratedProjectCount(projects: ArtistAlbum[]): number {
  return projects.filter((project) => project.rating !== null).length;
}

export function summarizeArtistProjects(artist: Pick<ArtistDetail, "albums">): { average: number | null; ratedProjects: number } {
  return { average: averageProjectRating(artist.albums), ratedProjects: ratedProjectCount(artist.albums) };
}

function compareProjects(left: ArtistAlbum, right: ArtistAlbum): number {
  if (left.year !== null && right.year !== null && left.year !== right.year) return right.year - left.year;
  if (left.year !== null && right.year === null) return -1;
  if (left.year === null && right.year !== null) return 1;
  return left.title.localeCompare(right.title);
}

export function groupArtistProjects(projects: ArtistAlbum[]): ArtistProjectGroup[] {
  return releaseTypeOrder.flatMap((releaseType) => {
    const grouped = projects.filter((project) => project.release_type === releaseType).sort(compareProjects);
    return grouped.length ? [{ releaseType, label: releaseTypeLabels[releaseType], projects: grouped }] : [];
  });
}
