import { request } from "./client";
import type { Album, MusicBrainzArtistPreview, MusicBrainzArtistSearchResult, MusicBrainzImport, MusicBrainzReleasePreview, MusicBrainzSearchResult } from "./types";

export const searchMusicBrainzReleases = (query: string, artist?: string) => { const params = new URLSearchParams({ query }); if (artist?.trim()) params.set("artist", artist.trim()); return request<MusicBrainzSearchResult[]>(`/api/metadata/musicbrainz/releases/search?${params}`); };
export const getMusicBrainzRelease = (releaseId: string) => request<MusicBrainzReleasePreview>(`/api/metadata/musicbrainz/releases/${releaseId}`);
export const importMusicBrainzRelease = (payload: MusicBrainzImport) => request<Album>("/api/metadata/musicbrainz/releases/import", { method: "POST", body: JSON.stringify(payload) });
export const searchMusicBrainzArtists = (query: string) => request<MusicBrainzArtistSearchResult[]>(`/api/metadata/musicbrainz/artists/search?${new URLSearchParams({ query })}`);
export const getMusicBrainzArtist = (artistId: string) => request<MusicBrainzArtistPreview>(`/api/metadata/musicbrainz/artists/${artistId}`);
