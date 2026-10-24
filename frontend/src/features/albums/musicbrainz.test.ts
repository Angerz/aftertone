import { expect, it } from "vitest";
import { musicBrainzImportPayload, musicBrainzTracklist } from "./musicbrainz";

it("turns an editable MusicBrainz preview into a normal local import payload", () => {
  const payload = musicBrainzImportPayload({ musicbrainz_release_id: "id", title: "Album", artists: ["Artist"], year: 2024, release_date: "2024-02-27", release_type: "album", source_release_type: "Album", disc_count: 2, cover_url: null, tracks: [{ disc_number: 1, position: 1, title: " Track ", primary_artists: [] }, { disc_number: 2, position: 1, title: "Second", primary_artists: ["Guest"] }] });
  expect(payload.artists).toEqual([{ name: "Artist" }]);
  expect(payload.tracks.map((track) => [track.disc_number, track.position, track.title])).toEqual([[1, 1, "Track"], [2, 1, "Second"]]);
  expect(payload.release_date).toBe("2024-02-27");
  expect(payload).not.toHaveProperty("source_release_type");
});

it("turns a MusicBrainz preview into an editable local tracklist", () => {
  const tracks = musicBrainzTracklist({ musicbrainz_release_id: "id", title: "Album", artists: ["Artist"], year: 2024, release_type: "album", source_release_type: "Album", disc_count: 2, cover_url: null, tracks: [{ disc_number: 1, position: 1, title: " First ", primary_artists: [] }, { disc_number: 2, position: 1, title: "Second", primary_artists: [] }] });
  expect(tracks).toEqual([{ disc_number: 1, title: "First" }, { disc_number: 2, title: "Second" }]);
});

it("preserves separate primary and featured source credits in release imports", () => {
  const payload = musicBrainzImportPayload({ musicbrainz_release_id: "id", title: "Compilation", artists: ["Various Artists"], year: 2026, release_type: "compilation", source_release_type: "Album", disc_count: 1, cover_url: null, tracks: [{ disc_number: 1, position: 1, title: " Song ", primary_artists: ["Lead", "Collaborator"], featured_artists: ["Guest", "Second guest"] }, { disc_number: 1, position: 2, title: "Inherited", primary_artists: [] }] });
  expect(payload.tracks[0].primary_artists).toEqual(["Lead", "Collaborator"]);
  expect(payload.tracks[0].featured_artists).toEqual(["Guest", "Second guest"]);
  expect(payload.tracks[0].title).toBe("Song");
  expect(payload.tracks[1].featured_artists).toEqual([]);
});
