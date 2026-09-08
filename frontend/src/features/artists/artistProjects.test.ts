import { describe, expect, it } from "vitest";
import type { ArtistAlbum, ArtistDetail } from "../../api/types";
import { averageProjectRating, groupArtistProjects, ratedProjectCount, summarizeArtistProjects } from "./artistProjects";

const project = (overrides: Partial<ArtistAlbum>): ArtistAlbum => ({ id: 1, title: "Project", year: 2020, release_type: "album", cover_url: null, artists: [], rating: null, ...overrides });

describe("artist projects", () => {
  it("averages only rated primary projects", () => {
    expect(averageProjectRating([project({ rating: 8 }), project({ id: 2, rating: null }), project({ id: 3, rating: 6 })])).toBe(7);
  });

  it("does not include featured appearances in the artist average", () => {
    const artist = { albums: [project({ rating: 8 })], featured_appearances: [{ track_id: 1, track_title: "Guest verse", album_id: 2, album_title: "Elsewhere", role: "featured" }] } as Pick<ArtistDetail, "albums" | "featured_appearances">;
    expect(summarizeArtistProjects(artist).average).toBe(8);
  });

  it("returns no average when every primary project is unrated", () => {
    const projects = [project({ rating: null })];
    expect(averageProjectRating(projects)).toBeNull();
    expect(ratedProjectCount(projects)).toBe(0);
  });

  it("groups only populated release types in editorial order", () => {
    const groups = groupArtistProjects([project({ release_type: "mixtape" }), project({ id: 2, release_type: "ep" })]);
    expect(groups.map((group) => group.label)).toEqual(["EPs", "Mixtapes"]);
  });

  it("sorts projects by year descending, then title, with unknown years last", () => {
    const groups = groupArtistProjects([project({ title: "Zeta", year: 2020 }), project({ id: 2, title: "Alpha", year: 2020 }), project({ id: 3, title: "Unknown", year: null }), project({ id: 4, title: "Newest", year: 2024 })]);
    expect(groups[0].projects.map((item) => item.title)).toEqual(["Newest", "Alpha", "Zeta", "Unknown"]);
  });
});
