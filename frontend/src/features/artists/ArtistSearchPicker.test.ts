import { expect, it } from "vitest";
import { addArtist, canCreateArtist, removeArtist } from "./ArtistSearchPicker";

const a = { id: 1, name: "Kelela" }; const b = { id: 2, name: "SZA" };
it("adds unique artists and removes individual selections", () => {
  expect(addArtist([a], a)).toEqual([a]);
  expect(removeArtist(addArtist([a], b), a.id)).toEqual([b]);
});

it("offers creation only for a meaningful query without an exact result", () => {
  expect(canCreateArtist("Nettspend", [])).toBe(true);
  expect(canCreateArtist("   ", [])).toBe(false);
  expect(canCreateArtist(" Kendrick   Lamar ", [{ id: 3, name: "Kendrick Lamar", normalized_name: "kendrick lamar" }])).toBe(false);
});
