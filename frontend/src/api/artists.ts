import { request } from "./client";
import type { Artist, ArtistDetail, PaginatedResponse } from "./types";

export const listArtists = (params: { page?: number; page_size?: number; search?: string } = {}) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); }); return request<PaginatedResponse<Artist>>(`/api/artists${query.size ? `?${query}` : ""}`); };
export const getArtist = (id: number) => request<ArtistDetail>(`/api/artists/${id}`);
export const createArtist = (name: string) => request<Artist>("/api/artists", { method: "POST", body: JSON.stringify({ name }) });
