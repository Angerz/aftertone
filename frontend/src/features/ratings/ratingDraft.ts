import type { Album, RatingRevisionDetail } from "../../api/types";

export interface DraftTrack { trackId: number; title: string; position: number; score: string; include: boolean; notes: string }
export interface RatingDraft { tracks: DraftTrack[]; coherence: string; coherenceNotes: string; emotion: string; emotionNotes: string; albumNotes: string }
export interface DraftFromRevision { draft: RatingDraft; ignoredSnapshotTrackIds: number[] }

export function emptyRatingDraft(album: Album): RatingDraft {
  return { tracks: album.tracks.map((track) => ({ trackId: track.id, title: track.title, position: track.position, score: "", include: true, notes: "" })), coherence: "5", coherenceNotes: "", emotion: "5", emotionNotes: "", albumNotes: "" };
}

/** Copies a historical snapshot into independent, editable current-album form state. */
export function revisionToRatingDraft(album: Album, revision: RatingRevisionDetail): DraftFromRevision {
  const currentTrackIds = new Set(album.tracks.map((track) => track.id));
  const snapshotsByTrackId = new Map(revision.tracks.map((track) => [track.track_id, track]));
  return {
    draft: {
      tracks: album.tracks.map((track) => {
        const snapshot = snapshotsByTrackId.get(track.id);
        return snapshot ? { trackId: track.id, title: track.title, position: track.position, score: snapshot.score === null ? "" : String(snapshot.score), include: snapshot.include_in_pre_rating, notes: snapshot.notes ?? "" } : { trackId: track.id, title: track.title, position: track.position, score: "", include: true, notes: "" };
      }),
      coherence: String(revision.coherence), coherenceNotes: revision.coherence_notes ?? "", emotion: String(revision.emotion), emotionNotes: revision.emotion_notes ?? "", albumNotes: revision.album_notes ?? "",
    },
    ignoredSnapshotTrackIds: revision.tracks.filter((track) => !currentTrackIds.has(track.track_id)).map((track) => track.track_id),
  };
}
