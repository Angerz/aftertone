export type AlbumMetadataField = "title" | "artists" | "year" | "release_date" | "release_type" | "disc_count";
export interface AlbumMetadataTarget { field: AlbumMetadataField; artistIndex?: number }
export interface AlbumMetadataIssue extends AlbumMetadataTarget { message: string }

/** Existing editor validation, with a focus target for the disclosure. */
export function validateAlbumMetadata(title: string, artists: string[], year: string): AlbumMetadataIssue | null {
  if (!title.trim() || !artists.some((artist) => artist.trim())) return { field: !title.trim() ? "title" : "artists", message: "Title and at least one artist are required." };
  const parsedYear = year ? Number(year) : null;
  if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1000 || parsedYear > 3000)) return { field: "year", message: "Enter a valid year." };
  return null;
}

/** Use the server's field path; a track title error is not an album title error. */
export function albumMetadataErrorTarget(paths: readonly (readonly (string | number)[])[]): AlbumMetadataTarget | null {
  const fields: AlbumMetadataField[] = ["title", "artists", "year", "release_date", "release_type", "disc_count"];
  for (const path of paths) {
    if (path[0] !== "body" || !fields.includes(path[1] as AlbumMetadataField)) continue;
    return { field: path[1] as AlbumMetadataField, ...(path[1] === "artists" && typeof path[2] === "number" ? { artistIndex: path[2] } : {}) };
  }
  return null;
}
