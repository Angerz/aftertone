import { expect, it } from "vitest";
import { addArtist, removeArtist } from "./ArtistSearchPicker";

const a = { id: 1, name: "Kelela" }; const b = { id: 2, name: "SZA" };
it("adds unique artists and removes individual selections", () => {
  expect(addArtist([a], a)).toEqual([a]);
  expect(removeArtist(addArtist([a], b), a.id)).toEqual([b]);
});
