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

export function formatProjectCounts(counts: Partial<Record<ReleaseType, number>>): string {
  const items = releaseTypeOrder.flatMap((releaseType) => {
    const count = counts[releaseType] ?? 0;
    return count ? [`${count} ${projectCountLabels[releaseType][count === 1 ? 0 : 1]}`] : [];
  });
  return items.length ? items.join(" · ") : "No primary projects";
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
