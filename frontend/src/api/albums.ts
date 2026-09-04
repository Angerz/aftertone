import { request } from "./client";
import type { Album, AlbumCreate } from "./types";
export const listAlbums = () => request<Album[]>("/api/albums");
export const getAlbum = (id: number) => request<Album>(`/api/albums/${id}`);
export const createAlbum = (payload: AlbumCreate) => request<Album>("/api/albums", { method: "POST", body: JSON.stringify(payload) });
export const uploadAlbumCover = (id: number, file: File) => { const data = new FormData(); data.append("file", file); return request<Album>(`/api/albums/${id}/cover`, { method: "PUT", body: data }); };
export const deleteAlbumCover = (id: number) => request<Album>(`/api/albums/${id}/cover`, { method: "DELETE" });
