import type { Album } from "../../api/types";
import type { RatingDraft } from "./ratingDraft";

const version = 1;
export interface StoredRatingDraft { version: number; albumId: number; baseRevisionId: number | null; savedAt: string; draft: RatingDraft }
export const ratingDraftKey = (albumId: number) => `aftertone:rating-draft:${albumId}`;

export function compatibleRatingDraft(album: Album, draft: RatingDraft): boolean {
  return draft.tracks.length === album.tracks.length && draft.tracks.every((item) => {
    const track = album.tracks.find((current) => current.id === item.trackId);
    return track?.title === item.title && track.disc_number === item.discNumber && track.position === item.position;
  });
}
export function loadRatingDraft(album: Album, storage: Storage = window.localStorage): StoredRatingDraft | null {
  try { const raw = storage.getItem(ratingDraftKey(album.id)); if (!raw) return null; const value = JSON.parse(raw) as StoredRatingDraft; return value.version === version && value.albumId === album.id && compatibleRatingDraft(album, value.draft) ? value : null; } catch { return null; }
}
export function saveRatingDraft(albumId: number, draft: RatingDraft, baseRevisionId: number | null, storage: Storage = window.localStorage): StoredRatingDraft {
  const value = { version, albumId, baseRevisionId, savedAt: new Date().toISOString(), draft };
  storage.setItem(ratingDraftKey(albumId), JSON.stringify(value)); return value;
}
export function clearRatingDraft(albumId: number, storage: Storage = window.localStorage) { storage.removeItem(ratingDraftKey(albumId)); }
