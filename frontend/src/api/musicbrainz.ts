import { request } from "./client";
import type { Album, MusicBrainzImport, MusicBrainzReleasePreview, MusicBrainzSearchResult } from "./types";

export const searchMusicBrainzReleases = (query: string, artist?: string) => { const params = new URLSearchParams({ query }); if (artist?.trim()) params.set("artist", artist.trim()); return request<MusicBrainzSearchResult[]>(`/api/metadata/musicbrainz/releases/search?${params}`); };
export const getMusicBrainzRelease = (releaseId: string) => request<MusicBrainzReleasePreview>(`/api/metadata/musicbrainz/releases/${releaseId}`);
export const importMusicBrainzRelease = (payload: MusicBrainzImport) => request<Album>("/api/metadata/musicbrainz/releases/import", { method: "POST", body: JSON.stringify(payload) });
