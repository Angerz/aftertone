import { request } from "./client";
import type { RatingRevisionCreate, RatingRevisionDetail, RatingRevisionSummary } from "./types";
export const createRevision = (albumId: number, payload: RatingRevisionCreate) => request<RatingRevisionDetail>(`/api/albums/${albumId}/revisions`, { method: "POST", body: JSON.stringify(payload) });
export const listRevisions = (albumId: number) => request<RatingRevisionSummary[]>(`/api/albums/${albumId}/revisions`);
export const getRevision = (albumId: number, revisionId: number) => request<RatingRevisionDetail>(`/api/albums/${albumId}/revisions/${revisionId}`);
