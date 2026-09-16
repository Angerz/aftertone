import { request } from "./client";
import type { FavoriteSongEntry, FavoriteSongImportPreview, FavoriteSongTrackSearch, FavoriteSongWrite } from "./types";
export const listFavoriteSongs = (view: "top" | "candidates", search = "") => request<FavoriteSongEntry[]>(`/api/favorite-songs?view=${view}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
export const searchFavoriteTracks = (q: string) => request<FavoriteSongTrackSearch[]>(`/api/tracks/search?q=${encodeURIComponent(q)}`);
export const createFavoriteSong = (payload: FavoriteSongWrite) => request<FavoriteSongEntry>("/api/favorite-songs", { method: "POST", body: JSON.stringify(payload) });
export const updateFavoriteSong = (id: number, payload: Omit<FavoriteSongWrite, "track_id">) => request<FavoriteSongEntry>(`/api/favorite-songs/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteFavoriteSong = (id: number) => request<{ deleted: boolean }>(`/api/favorite-songs/${id}`, { method: "DELETE" });
export const previewFavoriteSongImport = (file: File) => { const data = new FormData(); data.append("file", file); return request<FavoriteSongImportPreview>("/api/favorite-songs/import/preview", { method: "POST", body: data }); };
export const commitFavoriteSongImport = (rows: (FavoriteSongWrite & { source_row: number })[]) => request<{ imported: number; skipped: number }>("/api/favorite-songs/import/commit", { method: "POST", body: JSON.stringify({ rows }) });
