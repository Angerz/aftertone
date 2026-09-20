import { expect, it } from "vitest";
import { previewArtistProjects, toggleArtistExpansion } from "./artistExpansion";

it("keeps artist expansion independent by artist ID", () => {
  expect([...toggleArtistExpansion(new Set([1, 8]), 5)]).toEqual([1, 8, 5]);
  expect([...toggleArtistExpansion(new Set([1, 5, 8]), 5)]).toEqual([1, 8]);
});

it("limits a quick project preview to five projects", () => {
  expect(previewArtistProjects(Array.from({ length: 7 }, (_, id) => ({ id })) as never).map((project) => project.id)).toEqual([0, 1, 2, 3, 4]);
});
