import { mediaUrl } from "../../api/client";
import type { Album } from "../../api/types";

const initials = (album: Album) => `${album.title[0] ?? "A"}${album.artist[0] ?? "T"}`.toUpperCase();

export function AlbumCover({ album, className = "" }: { album: Album; className?: string }) {
  if (album.cover_url) return <img className={`album-cover ${className}`} src={mediaUrl(album.cover_url)} alt={`Cover art for ${album.title}`} />;
  return <div className={`album-cover cover-tone-${album.id % 5} ${className}`} aria-hidden="true"><span>{initials(album)}</span></div>;
}
