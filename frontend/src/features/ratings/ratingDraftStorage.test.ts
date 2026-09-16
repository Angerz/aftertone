import { describe, expect, it } from "vitest";
import { clearRatingDraft, compatibleRatingDraft, loadRatingDraft, ratingDraftKey, saveRatingDraft } from "./ratingDraftStorage";

const storage = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } as unknown as Storage; };
const album = { id: 4, tracks: [{ id: 1, title: "One", disc_number: 1, position: 1 }] } as any;
const draft = { tracks: [{ trackId: 1, title: "One", discNumber: 1, position: 1, score: "8", include: true, notes: "note" }], coherence: "7", coherenceNotes: "", emotion: "8", emotionNotes: "", albumNotes: "" };
describe("rating draft storage", () => {
  it("isolates, loads, and clears versioned album drafts", () => { const local = storage(); saveRatingDraft(4, draft, 9, local); expect(ratingDraftKey(4)).toBe("aftertone:rating-draft:4"); expect(loadRatingDraft(album, local)?.baseRevisionId).toBe(9); clearRatingDraft(4, local); expect(loadRatingDraft(album, local)).toBeNull(); });
  it("preserves a null score for an excluded unrated track", () => { const local = storage(); const unrated = { ...draft, tracks: [{ ...draft.tracks[0], score: null, include: false }] }; saveRatingDraft(4, unrated, null, local); expect(loadRatingDraft(album, local)?.draft.tracks[0].score).toBeNull(); });
  it("rejects malformed, future-version, and incompatible tracklists", () => { const local = storage(); local.setItem(ratingDraftKey(4), "{"); expect(loadRatingDraft(album, local)).toBeNull(); local.setItem(ratingDraftKey(4), JSON.stringify({ version: 2, albumId: 4, draft })); expect(loadRatingDraft(album, local)).toBeNull(); expect(compatibleRatingDraft({ ...album, tracks: [{ ...album.tracks[0], title: "Changed" }] }, draft)).toBe(false); });
});
