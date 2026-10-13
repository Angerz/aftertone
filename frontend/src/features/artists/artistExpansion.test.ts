import { expect, it } from "vitest";
import type { ArtistAlbum } from "../../api/types";
import { previewArtistProjects, toggleArtistExpansion } from "./artistExpansion";

const project = (overrides: Partial<ArtistAlbum>): ArtistAlbum => ({ id: 1, title: "Project", year: 2020, release_type: "album", cover_url: null, artists: [], rating: null, ...overrides });

it("keeps artist expansion independent by artist ID", () => {
  expect([...toggleArtistExpansion(new Set([1, 8]), 5)]).toEqual([1, 8, 5]);
  expect([...toggleArtistExpansion(new Set([1, 5, 8]), 5)]).toEqual([1, 8]);
});

it("limits a quick project preview to five projects", () => {
  expect(previewArtistProjects(Array.from({ length: 7 }, (_, id) => ({ id })) as never).map((project) => project.id)).toEqual([0, 1, 2, 3, 4]);
});

it("prioritizes rated projects before applying the five-project preview limit", () => {
  const projects = [
    project({ id: 1, title: "Unrated 2026", year: 2026 }),
    project({ id: 2, title: "Unrated 2025", year: 2025 }),
    project({ id: 3, title: "Rated 2024", year: 2024, rating: 7.9 }),
    project({ id: 4, title: "Rated zero", year: 2023, rating: 0 }),
    project({ id: 5, title: "Rated 2022", year: 2022, rating: 8.6 }),
    project({ id: 6, title: "Unrated 2020", year: 2020 }),
    project({ id: 7, title: "Unrated 2019", year: 2019 }),
  ];

  expect(previewArtistProjects(projects).map((item) => item.id)).toEqual([3, 4, 5, 1, 2]);
});

it("keeps chronological order when an artist has no rated projects", () => {
  expect(previewArtistProjects([
    project({ id: 1, title: "Year only", year: 2025 }),
    project({ id: 2, title: "March", year: 2025, release_date: "2025-03-15" }),
    project({ id: 3, title: "November", year: 2025, release_date: "2025-11-20" }),
  ]).map((item) => item.id)).toEqual([3, 2, 1]);
});
