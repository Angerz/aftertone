import { request } from "./client";
import type { Album, AlbumCreate } from "./types";
export const listAlbums = () => request<Album[]>("/api/albums");
export const getAlbum = (id: number) => request<Album>(`/api/albums/${id}`);
export const createAlbum = (payload: AlbumCreate) => request<Album>("/api/albums", { method: "POST", body: JSON.stringify(payload) });
