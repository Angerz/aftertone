import { describe, expect, it } from "vitest";

import type { Album, RatingRevisionDetail } from "../../api/types";
import { revisionToRatingDraft } from "./ratingDraft";

const album: Album = { id: 1, title: "Album", artist: "Artist", year: 2026, release_type: "album", created_at: "2026-01-01T00:00:00Z", tracks: [{ id: 10, position: 1, title: "Existing" }, { id: 20, position: 2, title: "New track" }], latest_revision: null };
const revision: RatingRevisionDetail = { id: 7, album_id: 1, created_at: "2026-02-01T00:00:00Z", pre_rating: 8, coherence: 7.5, coherence_notes: "A coherent record.", emotion: 8, emotion_notes: "It stays with me.", album_notes: "Long album note.", bad_experience: 0, final_rating: 8.2, tracks: [{ track_id: 10, title: "Old title", position: 1, score: 9.5, include_in_pre_rating: false, notes: "Keep this note." }, { track_id: 99, title: "Removed", position: 3, score: 4, include_in_pre_rating: true, notes: "Ignore this." }] };

describe("revisionToRatingDraft", () => {
  it("copies subjective values and matching track snapshot data into an editable draft", () => {
    const { draft } = revisionToRatingDraft(album, revision);
    expect(draft).toMatchObject({ coherence: "7.5", coherenceNotes: "A coherent record.", emotion: "8", emotionNotes: "It stays with me.", albumNotes: "Long album note." });
    expect(draft.tracks[0]).toMatchObject({ trackId: 10, score: "9.5", include: false, notes: "Keep this note." });
  });

  it("uses defaults for current tracks absent from the snapshot", () => {
    const { draft } = revisionToRatingDraft(album, revision);
    expect(draft.tracks[1]).toMatchObject({ trackId: 20, score: "", include: true, notes: "" });
  });

  it("ignores snapshot tracks that no longer exist in the current album", () => {
    const { draft, ignoredSnapshotTrackIds } = revisionToRatingDraft(album, revision);
    expect(draft.tracks).toHaveLength(2);
    expect(ignoredSnapshotTrackIds).toEqual([99]);
  });
});
