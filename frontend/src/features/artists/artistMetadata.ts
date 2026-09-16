import type { Artist } from "../../api/types";

function countryName(code: string): string {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function countryFlag(code: string): string {
  return String.fromCodePoint(...code.toUpperCase().split("").map((letter) => 0x1f1a5 + letter.charCodeAt(0)));
}

function ageAt(from: string, until: Date): number {
  const birth = new Date(`${from}T00:00:00`);
  let age = until.getFullYear() - birth.getFullYear();
  if (until.getMonth() < birth.getMonth() || (until.getMonth() === birth.getMonth() && until.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function artistMetadata(artist: Pick<Artist, "artist_type" | "country_code" | "birth_date" | "death_date" | "formed_year" | "dissolved_year">, today = new Date()): string | null {
  const parts = artist.country_code ? [`${countryFlag(artist.country_code)} ${countryName(artist.country_code)}`] : [];
  if (artist.artist_type === "person" && artist.birth_date) {
    const birthYear = artist.birth_date.slice(0, 4);
    if (artist.death_date) parts.push(`${birthYear}–${artist.death_date.slice(0, 4)}`, `Age ${ageAt(artist.birth_date, new Date(`${artist.death_date}T00:00:00`))}`);
    else parts.push(`born ${birthYear}`, `age ${ageAt(artist.birth_date, today)}`);
  } else if (artist.artist_type === "group" && artist.formed_year) {
    parts.push(artist.dissolved_year ? `${artist.formed_year}–${artist.dissolved_year}` : `formed ${artist.formed_year}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
