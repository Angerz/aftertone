import { request } from "./client";
import type { Album, AlbumCreate, AlbumFacets, AlbumRatingSummary, AlbumUpdate, PaginatedResponse, Track, TrackCreditsUpdate } from "./types";
export interface AlbumListParams { page?: number; page_size?: number; year?: number; decade?: number; search?: string; sort?: "rating" | "recent" | "year" | "artist" | "title" }
export const listAlbums = (params: AlbumListParams = {}) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); }); return request<PaginatedResponse<Album>>(`/api/albums${query.size ? `?${query}` : ""}`); };
export const getAlbumFacets = () => request<AlbumFacets>("/api/albums/facets");
export const getAlbumRatingSummary = (params: Pick<AlbumListParams, "year" | "decade"> = {}) => { const query = new URLSearchParams(); if (params.year !== undefined) query.set("year", String(params.year)); if (params.decade !== undefined) query.set("decade", String(params.decade)); return request<AlbumRatingSummary>(`/api/albums/summary${query.size ? `?${query}` : ""}`); };
export const getAlbum = (id: number) => request<Album>(`/api/albums/${id}`);
export const createAlbum = (payload: AlbumCreate) => request<Album>("/api/albums", { method: "POST", body: JSON.stringify(payload) });
export const updateAlbum = (id: number, payload: AlbumUpdate) => request<Album>(`/api/albums/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const uploadAlbumCover = (id: number, file: File) => { const data = new FormData(); data.append("file", file); return request<Album>(`/api/albums/${id}/cover`, { method: "PUT", body: data }); };
export const importAlbumCoverFromUrl = (id: number, url: string) => request<Album>(`/api/albums/${id}/cover/from-url`, { method: "POST", body: JSON.stringify({ url }) });
export const deleteAlbumCover = (id: number) => request<Album>(`/api/albums/${id}/cover`, { method: "DELETE" });
export const markAlbumForRevisit = (id: number, reason: string) => request<Album>(`/api/albums/${id}/revisit`, { method: "PATCH", body: JSON.stringify({ reason: reason || null }) });
export const clearAlbumRevisit = (id: number) => request<Album>(`/api/albums/${id}/revisit`, { method: "DELETE" });
export const updateTrackArtists = (id: number, payload: TrackCreditsUpdate) => request<Track>(`/api/tracks/${id}/artists`, { method: "PATCH", body: JSON.stringify(payload) });
