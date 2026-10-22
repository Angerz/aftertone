import type { ArtistMetadataFields } from "./MusicBrainzArtistImport";

export type ArtistEditField = "name" | "artist_type" | "country_code" | "birth_date" | "death_date" | "formed_year" | "dissolved_year";
export interface ArtistEditIssue { field: ArtistEditField; message: string }

/** Preserve the existing editor's validation rules and messages. */
export function validateArtistEdit(fields: Pick<ArtistMetadataFields, "name" | "countryCode" | "formedYear" | "dissolvedYear">): ArtistEditIssue | null {
  if (!fields.name.trim()) return { field: "name", message: "Artist name is required." };
  if (fields.countryCode && !/^[a-z]{2}$/i.test(fields.countryCode.trim())) return { field: "country_code", message: "Use a two-letter ISO country code, such as ES or US." };
  for (const [field, value] of [["formed_year", fields.formedYear], ["dissolved_year", fields.dissolvedYear]] as const) {
    if (value && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 9999)) return { field, message: "Enter valid four-digit years." };
  }
  return null;
}

export function artistEditErrorField(paths: readonly (readonly (string | number)[])[]): ArtistEditField | null {
  const fields: ArtistEditField[] = ["name", "artist_type", "country_code", "birth_date", "death_date", "formed_year", "dissolved_year"];
  for (const path of paths) if (path[0] === "body" && fields.includes(path[1] as ArtistEditField)) return path[1] as ArtistEditField;
  return null;
}
