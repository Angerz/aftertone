import { describe, expect, it } from "vitest";
import type { ArtistAlbum, ArtistDetail } from "../../api/types";
import { averageProjectRating, formatProjectCounts, groupArtistProjects, projectRatingProgress, projectTypeDistribution, ratedProjectCount, summarizeArtistProjects } from "./artistProjects";

const project = (overrides: Partial<ArtistAlbum>): ArtistAlbum => ({ id: 1, title: "Project", year: 2020, release_type: "album", cover_url: null, artists: [], rating: null, ...overrides });

describe("artist projects", () => {
  it("averages only rated primary projects", () => {
    expect(averageProjectRating([project({ rating: 8 }), project({ id: 2, rating: null }), project({ id: 3, rating: 6 })])).toBe(7);
  });

  it("does not include featured appearances in the artist average", () => {
    const artist = { albums: [project({ rating: 8 })], featured_appearances: [{ track_id: 1, track_title: "Guest verse", track_position: 1, album_id: 2, album_title: "Elsewhere", album_year: 2024, album_release_type: "album", album_cover_url: null, score: 10, role: "featured" }] } as Pick<ArtistDetail, "albums" | "featured_appearances">;
    expect(summarizeArtistProjects(artist).average).toBe(8);
  });

  it("returns no average for an artist with featured tracks only", () => {
    const artist = { albums: [], featured_appearances: [{ track_id: 1, track_title: "Guest verse", track_position: 1, album_id: 2, album_title: "Elsewhere", album_year: 2024, album_release_type: "album", album_cover_url: null, score: 9, role: "featured" }] } as Pick<ArtistDetail, "albums" | "featured_appearances">;
    expect(summarizeArtistProjects(artist)).toEqual({ average: null, ratedProjects: 0 });
  });

  it("returns no average when every primary project is unrated", () => {
    const projects = [project({ rating: null })];
    expect(averageProjectRating(projects)).toBeNull();
    expect(ratedProjectCount(projects)).toBe(0);
  });

  it("groups only populated release types in editorial order", () => {
    const groups = groupArtistProjects([project({ release_type: "reissue" }), project({ id: 2, release_type: "live" }), project({ id: 3, release_type: "mixtape" }), project({ id: 4, release_type: "ep" })]);
    expect(groups.map((group) => group.label)).toEqual(["EPs", "Mixtapes", "Live", "Reissues"]);
  });

  it("sorts projects by year descending, then title, with unknown years last", () => {
    const groups = groupArtistProjects([project({ title: "Zeta", year: 2020 }), project({ id: 2, title: "Alpha", year: 2020 }), project({ id: 3, title: "Unknown", year: null }), project({ id: 4, title: "Newest", year: 2024 })]);
    expect(groups[0].projects.map((item) => item.title)).toEqual(["Newest", "Alpha", "Zeta", "Unknown"]);
  });

  it("prioritizes exact dates within a year without inventing dates for year-only projects", () => {
    const groups = groupArtistProjects([
      project({ id: 1, title: "Year only", year: 2025 }),
      project({ id: 2, title: "March", year: 2025, release_date: "2025-03-15" }),
      project({ id: 3, title: "November", year: 2025, release_date: "2025-11-20" }),
      project({ id: 4, title: "Older", year: 2024, release_date: "2024-12-01" }),
      project({ id: 5, title: "Alpha", year: 2025 }),
    ]);
    expect(groups[0].projects.map((item) => item.title)).toEqual(["November", "March", "Alpha", "Year only", "Older"]);
  });

  it("formats project counts in release-type order with correct singulars", () => {
    expect(formatProjectCounts({ album: 4, ep: 1, mixtape: 1 })).toBe("4 albums · 1 EP · 1 mixtape");
    expect(formatProjectCounts({ live: 1 })).toBe("1 live project");
    expect(formatProjectCounts({})).toBe("No primary projects");
  });

  it("counts every rated primary project for the completion indicator", () => {
    const progress = projectRatingProgress([project({ rating: 8 }), project({ id: 2, rating: null }), project({ id: 3, release_type: "ep", rating: 9 })]);
    expect(progress).toMatchObject({ total: 3, rated: 2 });
  });

  it("returns populated project types with their primary-project counts", () => {
    expect(projectTypeDistribution([project({ release_type: "album" }), project({ id: 2, release_type: "album" }), project({ id: 3, release_type: "mixtape" })])).toEqual([
      { releaseType: "album", label: "Albums", count: 2 }, { releaseType: "mixtape", label: "Mixtapes", count: 1 },
    ]);
    expect(projectTypeDistribution([])).toEqual([]);
  });
});
