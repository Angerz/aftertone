import { request } from "./client";
import type { LegacyRatingDetail } from "./types";
export const getLegacyRating = (id: number) => request<LegacyRatingDetail>(`/api/legacy-ratings/${id}`);
export const reconcileLegacyRating = (id: number, trackTitles: string[], mappings: { legacy_score_index: number; track_id: number }[]) => request<{ revision_id: number }>(`/api/legacy-ratings/${id}/reconcile`, { method: "POST", body: JSON.stringify({ track_titles: trackTitles, track_mappings: mappings }) });
export const previewLegacyReconciliation = (id: number, trackTitles: string[], mappings: { legacy_score_index: number; track_id: number }[]) => request<{ pre_rating: number | null; bad_experience: number | null; final_rating: number | null }>(`/api/legacy-ratings/${id}/reconcile-preview`, { method: "POST", body: JSON.stringify({ track_titles: trackTitles, track_mappings: mappings }) });
