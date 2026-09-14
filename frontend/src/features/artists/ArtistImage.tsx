import { mediaUrl } from "../../api/client";
import type { Artist } from "../../api/types";

export function artistInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function ArtistImage({ artist, className = "" }: { artist: Pick<Artist, "name" | "image_url">; className?: string }) {
  if (artist.image_url) return <img className={`artist-image ${className}`} src={mediaUrl(artist.image_url)} alt={`Portrait of ${artist.name}`} />;
  return <div className={`artist-image artist-image-placeholder ${className}`} aria-hidden="true">{artistInitials(artist.name)}</div>;
}
