import type { TrackUpdate } from "../../api/types";

export interface AlbumTrackDraft extends TrackUpdate { editorKey: string }
let nextDraftKey = 0;

export function albumTrackDrafts(tracks: TrackUpdate[]): AlbumTrackDraft[] {
  return tracks.map((track) => ({ ...track, editorKey: track.id === undefined ? `draft-${++nextDraftKey}` : `track-${track.id}` }));
}

/** Reorder only the selected disc; keep every track object and persisted identity. */
export function reorderDiscTracks<T extends TrackUpdate>(tracks: T[], disc: number, from: number, to: number): T[] {
  const members = tracks.filter((track) => track.disc_number === disc);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= members.length || to >= members.length || from === to) return tracks;
  const [moved] = members.splice(from, 1);
  members.splice(to, 0, moved);
  let index = 0;
  return tracks.map((track) => track.disc_number === disc ? members[index++] : track);
}

export function trackUpdatePayload(tracks: AlbumTrackDraft[]): TrackUpdate[] {
  return tracks.map(({ id, disc_number, title }) => ({ ...(id === undefined ? {} : { id }), disc_number, title: title.trim() }));
}
