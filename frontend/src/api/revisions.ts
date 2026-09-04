import { request } from "./client";
import type { RatingRevision, RatingRevisionCreate, RatingRevisionSummary } from "./types";
export const createRevision = (albumId: number, payload: RatingRevisionCreate) => request<RatingRevision>(`/api/albums/${albumId}/revisions`, { method: "POST", body: JSON.stringify(payload) });
export const listRevisions = (albumId: number) => request<RatingRevisionSummary[]>(`/api/albums/${albumId}/revisions`);
