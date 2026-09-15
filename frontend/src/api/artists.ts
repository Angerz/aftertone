import { request } from "./client";
import type { Artist, ArtistDetail, PaginatedResponse } from "./types";

export type ArtistListSort = "name" | "rating" | "projects";
export type ArtistScope = "primary" | "featuring";
export const listArtists = (params: { page?: number; page_size?: number; search?: string; active?: boolean; unused?: boolean; scope?: ArtistScope; sort?: ArtistListSort } = {}) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); }); return request<PaginatedResponse<Artist>>(`/api/artists${query.size ? `?${query}` : ""}`); };
export const getArtist = (id: number) => request<ArtistDetail>(`/api/artists/${id}`);
export const createArtist = (name: string) => request<Artist>("/api/artists", { method: "POST", body: JSON.stringify({ name }) });
export const updateArtist = (id: number, is_active: boolean) => request<Artist>(`/api/artists/${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) });
export const deleteArtist = (id: number) => request<{ deleted: boolean }>(`/api/artists/${id}`, { method: "DELETE" });
export const uploadArtistImage = (id: number, file: File) => { const data = new FormData(); data.append("file", file); return request<Artist>(`/api/artists/${id}/image`, { method: "PUT", body: data }); };
export const deleteArtistImage = (id: number) => request<Artist>(`/api/artists/${id}/image`, { method: "DELETE" });
export const importArtistImageFromUrl = (id: number, url: string) => request<Artist>(`/api/artists/${id}/image/from-url`, { method: "POST", body: JSON.stringify({ url }) });
