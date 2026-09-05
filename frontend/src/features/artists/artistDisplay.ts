import type { Artist } from "../../api/types";

export function formatArtistNames(artists: Artist[]): string {
  const names = artists.map((artist) => artist.name);
  return names.length < 2 ? names[0] ?? "Unknown artist" : names.length === 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
