export type ReleaseType = "album" | "ep" | "mixtape" | "compilation" | "live" | "reissue";
export interface PaginatedResponse<T> { items: T[]; page: number; page_size: number; total: number; total_pages: number }
export interface Artist { id: number; name: string; album_count?: number }
export interface ArtistCreditInput { artist_id?: number; name?: string }
export interface ArtistAlbum { id: number; title: string; year: number | null; release_type: ReleaseType; cover_url: string | null; artists: Artist[]; rating: number | null }
export interface TrackAppearance { track_id: number; track_title: string; album_id: number; album_title: string; role: "featured" }
export interface ArtistDetail extends Artist { albums: ArtistAlbum[]; featured_appearances: TrackAppearance[] }

export interface Track { id: number; disc_number: number; position: number; title: string; primary_artists: Artist[]; featured_artists: Artist[]; uses_album_artists: boolean }
export interface LatestRevision { id: number; created_at: string; pre_rating: number | null; final_rating: number | null }
export interface LatestLegacyRating { id: number; imported_at: string; legacy_final_rating: number | null; computed_final_rating: number | null; reconciliation_status: string }
export interface Album {
  id: number; title: string; artists: Artist[]; year: number | null;
  release_type: ReleaseType; disc_count: number; created_at: string; tracks: Track[]; latest_revision: LatestRevision | null; cover_url: string | null; needs_revisit: boolean; revisit_reason: string | null; revisit_marked_at: string | null; latest_legacy_rating: LatestLegacyRating | null;
}
export interface TrackCreate { disc_number: number; position: number; title: string }
export interface AlbumCreate { title: string; artists: ArtistCreditInput[]; year: number | null; release_type: ReleaseType; disc_count: number; tracks: TrackCreate[] }
export interface TrackUpdate { id?: number; disc_number: number; title: string }
export interface AlbumUpdate { title: string; artists: ArtistCreditInput[]; year: number | null; release_type: ReleaseType; disc_count: number; tracks?: TrackUpdate[] }
export interface TrackCreditsUpdate { primary_artist_ids: number[]; featured_artist_ids: number[] }
export interface TrackRatingRevision { track_id: number; title: string; disc_number: number; position: number; score: number | null; include_in_pre_rating: boolean; notes: string | null }
export interface TrackRatingRevisionCreate { track_id: number; score: number; include_in_pre_rating: boolean; notes: string | null }
export interface RatingRevisionDetail {
  id: number; album_id: number; created_at: string; pre_rating: number | null;
  coherence: number; coherence_notes: string | null; emotion: number; emotion_notes: string | null;
  album_notes: string | null; bad_experience: number | null; final_rating: number | null;
  tracks: TrackRatingRevision[];
}
export interface RatingRevisionSummary { id: number; created_at: string; pre_rating: number | null; coherence: number; emotion: number; bad_experience: number | null; final_rating: number | null }
export interface RatingRevisionCreate { coherence: number; coherence_notes: string | null; emotion: number; emotion_notes: string | null; album_notes: string | null; tracks: TrackRatingRevisionCreate[] }
export interface LegacyImportRow { row_number: number; title: string | null; artist: string | null; legacy_final_rating: number | null; legacy_pre_rating: number | null; legacy_bad_experience: number | null; computed_pre_rating: number | null; computed_bad_experience: number | null; computed_final_rating: number | null; pre_formula: string | null; extracted_score_count: number; status: "ready" | "unrated" | "warning" | "error"; warnings: string[]; errors: string[] }
export interface LegacyImportPreview { rows: LegacyImportRow[] }
export interface LegacyImportCommit { imported: number; skipped: number; failed: number }
export interface LegacyRatingDetail { id: number; album_id: number; extracted_scores: number[]; coherence: number; emotion: number; legacy_pre_rating: number | null; legacy_bad_experience: number | null; legacy_final_rating: number | null; reconciliation_status: string }
export interface AlbumFacets { decades: Record<string, number[]> }
