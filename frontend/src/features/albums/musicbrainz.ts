import type { MusicBrainzImport, MusicBrainzReleasePreview, TrackUpdate } from "../../api/types";

export function musicBrainzImportPayload(preview: MusicBrainzReleasePreview): MusicBrainzImport {
  return {
    musicbrainz_release_id: preview.musicbrainz_release_id, title: preview.title.trim(), year: preview.year,
    release_type: preview.release_type, disc_count: preview.disc_count, cover_url: preview.cover_url,
    artists: preview.artists.map((name) => ({ name })),
    tracks: preview.tracks.map((track) => ({ ...track, title: track.title.trim(), primary_artists: track.primary_artists.filter(Boolean) })),
  };
}

export function musicBrainzTracklist(preview: MusicBrainzReleasePreview): TrackUpdate[] {
  return preview.tracks.map((track) => ({ disc_number: track.disc_number, title: track.title.trim() }));
}
