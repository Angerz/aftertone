import type { ArtistAlbum, ArtistDetail, ReleaseType } from "../../api/types";

const releaseTypeLabels: Record<ReleaseType, string> = {
  album: "Albums",
  soundtrack: "Soundtracks",
  single: "Singles",
  unknown: "Other projects",
  ep: "EPs",
  mixtape: "Mixtapes",
  compilation: "Compilations",
  live: "Live",
  reissue: "Reissues",
};

const releaseTypeOrder: ReleaseType[] = ["album", "soundtrack", "single", "unknown", "ep", "mixtape", "compilation", "live", "reissue"];

const projectCountLabels: Record<ReleaseType, [string, string]> = {
  album: ["album", "albums"], soundtrack: ["soundtrack", "soundtracks"], ep: ["EP", "EPs"], mixtape: ["mixtape", "mixtapes"],
  single: ["single", "singles"], unknown: ["other project", "other projects"],
  compilation: ["compilation", "compilations"], live: ["live project", "live projects"], reissue: ["reissue", "reissues"],
};

export interface ArtistProjectGroup {
  releaseType: ReleaseType;
  label: string;
  projects: ArtistAlbum[];
}

export interface ProjectRatingProgress {
  total: number;
  rated: number;
  projects: ArtistAlbum[];
}

export interface ProjectTypeDistribution {
  releaseType: ReleaseType;
  label: string;
  count: number;
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

export function projectRatingProgress(projects: ArtistAlbum[]): ProjectRatingProgress {
  return { projects, total: projects.length, rated: ratedProjectCount(projects) };
}

export function projectTypeDistribution(projects: ArtistAlbum[]): ProjectTypeDistribution[] {
  return releaseTypeOrder.flatMap((releaseType) => {
    const count = projects.filter((project) => project.release_type === releaseType).length;
    return count ? [{ releaseType, label: releaseTypeLabels[releaseType], count }] : [];
  });
}

export function formatProjectCounts(counts: Partial<Record<ReleaseType, number>>): string {
  const items = releaseTypeOrder.flatMap((releaseType) => {
    const count = counts[releaseType] ?? 0;
    return count ? [`${count} ${projectCountLabels[releaseType][count === 1 ? 0 : 1]}`] : [];
  });
  return items.length ? items.join(" · ") : "No primary projects";
}

export function compareArtistProjects(left: ArtistAlbum, right: ArtistAlbum): number {
  const leftYear = left.year ?? null; const rightYear = right.year ?? null;
  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) return rightYear - leftYear;
  if (leftYear !== null && rightYear === null) return -1;
  if (leftYear === null && rightYear !== null) return 1;
  const leftDate = left.release_date ?? null; const rightDate = right.release_date ?? null;
  if (leftDate && rightDate && leftDate !== rightDate) return rightDate.localeCompare(leftDate);
  if (leftDate && !rightDate) return -1;
  if (!leftDate && rightDate) return 1;
  return (left.title ?? "").localeCompare(right.title ?? "") || left.id - right.id;
}

export function groupArtistProjects(projects: ArtistAlbum[]): ArtistProjectGroup[] {
  return releaseTypeOrder.flatMap((releaseType) => {
    const grouped = projects.filter((project) => project.release_type === releaseType).sort(compareArtistProjects);
    return grouped.length ? [{ releaseType, label: releaseTypeLabels[releaseType], projects: grouped }] : [];
  });
}
