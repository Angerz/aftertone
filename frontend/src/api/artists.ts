import { request } from "./client";
import type { Artist, ArtistDetail } from "./types";

export const listArtists = () => request<Artist[]>("/api/artists");
export const getArtist = (id: number) => request<ArtistDetail>(`/api/artists/${id}`);
export const createArtist = (name: string) => request<Artist>("/api/artists", { method: "POST", body: JSON.stringify({ name }) });
