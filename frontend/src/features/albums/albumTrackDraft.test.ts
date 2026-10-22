import { expect, it } from "vitest";
import { albumTrackDrafts, reorderDiscTracks, trackUpdatePayload } from "./albumTrackDraft";

it("keeps new duplicate titles individually identifiable through editing and reordering", () => {
  const drafts = albumTrackDrafts([{ title: "Same", disc_number: 1 }, { title: "Same", disc_number: 1 }]);
  expect(drafts[0].editorKey).not.toBe(drafts[1].editorKey);
  const edited = drafts.map((track, index) => index === 0 ? { ...track, title: "Changed" } : track);
  expect(reorderDiscTracks(edited, 1, 0, 1)[1].editorKey).toBe(drafts[0].editorKey);
});

it("moves across multiple positions within one disc without changing IDs or other discs", () => {
  const tracks = albumTrackDrafts([{ id: 1, title: "One", disc_number: 1 }, { id: 2, title: "Other disc", disc_number: 2 }, { id: 3, title: "Three", disc_number: 1 }, { id: 4, title: "Four", disc_number: 1 }]);
  const moved = reorderDiscTracks(tracks, 1, 0, 2);
  expect(moved.map((track) => track.id)).toEqual([3, 2, 4, 1]);
  expect(moved[1]).toBe(tracks[1]);
  expect(moved[3]).toBe(tracks[0]);
  expect(reorderDiscTracks(moved, 1, 2, 0)).toEqual(tracks);
});

it("ignores invalid and canceled/no-op destinations", () => {
  const tracks = albumTrackDrafts([{ id: 1, title: "One", disc_number: 1 }]);
  for (const [from, to] of [[0, 0], [0, 1], [-1, 0], [NaN, 0], [0, .5]]) expect(reorderDiscTracks(tracks, 1, from, to)).toBe(tracks);
});

it("never sends client identities in the API payload or invents persisted track IDs", () => {
  const drafts = albumTrackDrafts([{ id: 4, title: " Existing ", disc_number: 2 }, { title: " New ", disc_number: 1 }]);
  expect(trackUpdatePayload(drafts)).toEqual([{ id: 4, title: "Existing", disc_number: 2 }, { title: "New", disc_number: 1 }]);
});
