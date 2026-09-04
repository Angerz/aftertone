import { describe, expect, it } from "vitest";
import type { Album } from "../../api/types";
import { filterAndSortAlbums } from "./library";

const albums: Album[] = [
  { id: 1, title: "Unrated", artist: "Beta", year: 2020, release_type: "album", created_at: "2020-01-01", tracks: [], latest_revision: null, cover_url: null, needs_revisit: false, revisit_reason: null, revisit_marked_at: null, latest_legacy_rating: null },
  { id: 2, title: "High", artist: "Alpha", year: 2021, release_type: "album", created_at: "2021-01-01", tracks: [], latest_revision: { id: 1, created_at: "2026-01-01", pre_rating: 9, final_rating: 9.5 }, cover_url: null, needs_revisit: false, revisit_reason: null, revisit_marked_at: null, latest_legacy_rating: null },
  { id: 3, title: "Low", artist: "Gamma", year: 2022, release_type: "album", created_at: "2022-01-01", tracks: [], latest_revision: { id: 2, created_at: "2025-01-01", pre_rating: 7, final_rating: 7.2 }, cover_url: null, needs_revisit: false, revisit_reason: null, revisit_marked_at: null, latest_legacy_rating: null },
];

describe("filterAndSortAlbums", () => {
  it("filters title and artist without case sensitivity", () => expect(filterAndSortAlbums(albums, "aLpHa", "rating").map((album) => album.id)).toEqual([2]));
  it("sorts rated albums by highest rating and leaves unrated albums last", () => expect(filterAndSortAlbums(albums, "", "rating").map((album) => album.id)).toEqual([2, 3, 1]));
});
