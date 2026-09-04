export type ReleaseType = "album" | "ep" | "mixtape" | "compilation";

export interface Track { id: number; position: number; title: string }
export interface Album {
  id: number; title: string; artist: string; year: number | null;
  release_type: ReleaseType; created_at: string; tracks: Track[];
}
export interface TrackCreate { position: number; title: string }
export interface AlbumCreate { title: string; artist: string; year: number | null; release_type: ReleaseType; tracks: TrackCreate[] }
export interface TrackRatingRevision { track_id: number; title: string; position: number; score: number; include_in_pre_rating: boolean; notes: string | null }
export interface TrackRatingRevisionCreate { track_id: number; score: number; include_in_pre_rating: boolean; notes: string | null }
export interface RatingRevisionDetail {
  id: number; album_id: number; created_at: string; pre_rating: number | null;
  coherence: number; coherence_notes: string | null; emotion: number; emotion_notes: string | null;
  album_notes: string | null; bad_experience: number | null; final_rating: number | null;
  tracks: TrackRatingRevision[];
}
export interface RatingRevisionSummary { id: number; created_at: string; pre_rating: number | null; coherence: number; emotion: number; bad_experience: number | null; final_rating: number | null }
export interface RatingRevisionCreate { coherence: number; coherence_notes: string | null; emotion: number; emotion_notes: string | null; album_notes: string | null; tracks: TrackRatingRevisionCreate[] }
