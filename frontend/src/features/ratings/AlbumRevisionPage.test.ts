import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Album, RatingRevisionDetail } from "../../api/types";
import { getAlbum } from "../../api/albums";
import { getRevision } from "../../api/revisions";
import { ApiError } from "../../api/client";
import { loadAlbumRevision } from "./AlbumRevisionPage";

vi.mock("../../api/albums", () => ({ getAlbum: vi.fn() }));
vi.mock("../../api/revisions", () => ({ getRevision: vi.fn() }));

const album: Album = { id: 3, title: "Current catalogue title", artists: [{ id: 1, name: "Synthetic artist" }], year: 2026, release_type: "album", disc_count: 1, tracks: [], cover_url: null, latest_revision: null, latest_legacy_rating: null, needs_revisit: false, revisit_reason: null, revisit_marked_at: null };
const revision: RatingRevisionDetail = { id: 7, album_id: 3, created_at: "2026-01-01T12:00:00Z", pre_rating: 0, coherence: 0, coherence_notes: "Historical coherence", emotion: 5, emotion_notes: null, album_notes: "Historical album note", bad_experience: 1, final_rating: -0.5, rating_breakdown: { pre_contribution: 0, coherence_contribution: 0, bad_experience_contribution: -0.5, emotion_contribution: 0, final_rating: -0.5 }, tracks: [{ track_id: 14, title: "Historical track title", disc_number: 2, position: 1, score: 0, include_in_pre_rating: true, notes: "Historical track note" }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAlbum).mockResolvedValue(album);
  vi.mocked(getRevision).mockResolvedValue(revision);
});

describe("revision-specific data loading", () => {
  it("requests the exact album/revision pair without modifying its historical data", async () => {
    const original = structuredClone(revision);
    const loaded = await loadAlbumRevision(3, 7);
    expect(getAlbum).toHaveBeenCalledWith(3);
    expect(getRevision).toHaveBeenCalledWith(3, 7);
    expect(loaded.revision).toBe(revision);
    expect(revision).toEqual(original);
  });

  it("preserves server-redacted guest notes rather than restoring owner content", async () => {
    const guest = { ...revision, coherence_notes: null, album_notes: null, tracks: revision.tracks.map((track) => ({ ...track, notes: null })) };
    vi.mocked(getRevision).mockResolvedValue(guest);
    expect((await loadAlbumRevision(3, 7)).revision).toBe(guest);
    expect(guest.album_notes).toBeNull();
    expect(guest.tracks[0].notes).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid ID %s before requesting any data", async (id) => {
    await expect(loadAlbumRevision(3, id)).rejects.toThrow("could not be found");
    expect(getAlbum).not.toHaveBeenCalled();
    expect(getRevision).not.toHaveBeenCalled();
  });

  it.each([{ album_id: 9 }, { id: 42 }])("rejects a response not matching the requested pair: %j", async (mismatch) => {
    vi.mocked(getRevision).mockResolvedValue({ ...revision, ...mismatch });
    await expect(loadAlbumRevision(3, 7)).rejects.toThrow("could not be found");
  });

  it("also rejects an album response with the wrong identity", async () => {
    vi.mocked(getAlbum).mockResolvedValue({ ...album, id: 9 });
    await expect(loadAlbumRevision(3, 7)).rejects.toThrow("could not be found");
  });

  it("propagates missing revisions as failures instead of displaying the latest revision", async () => {
    vi.mocked(getRevision).mockRejectedValue(new ApiError("revision not found", 404));
    await expect(loadAlbumRevision(3, 404)).rejects.toMatchObject({ status: 404 });
    expect(getRevision).toHaveBeenCalledWith(3, 404);
  });
});
