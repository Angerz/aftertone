import { expect, it } from "vitest";
import { albumMetadataErrorTarget, validateAlbumMetadata } from "./albumMetadataValidation";

it("keeps the required-field message and focuses the first invalid metadata input", () => {
  expect(validateAlbumMetadata("  ", [], "bad")).toEqual({ field: "title", message: "Title and at least one artist are required." });
  expect(validateAlbumMetadata("Album", ["  ", ""], "2024")?.field).toBe("artists");
  expect(validateAlbumMetadata("Album", ["", "Artist"], "2024")).toBeNull();
});
it("preserves optional years, integer bounds and the existing year message", () => {
  for (const year of ["", "1000", "2024", "3000"]) expect(validateAlbumMetadata("Album", ["Artist"], year)).toBeNull();
  for (const year of ["999", "3001", "2024.5", "bad"]) expect(validateAlbumMetadata("Album", ["Artist"], year)).toEqual({ field: "year", message: "Enter a valid year." });
});
it("maps server metadata paths and targets the specified artist", () => {
  expect(albumMetadataErrorTarget([["body", "artists", 1, "name"]])).toEqual({ field: "artists", artistIndex: 1 });
  expect(albumMetadataErrorTarget([["body", "release_date"]])).toEqual({ field: "release_date" });
});
it("does not confuse nested track or credit validation with album metadata", () => {
  expect(albumMetadataErrorTarget([["body", "tracks", 0, "title"], ["body", "primary_artist_ids"]])).toBeNull();
  expect(albumMetadataErrorTarget([["query", "title"]])).toBeNull();
});
