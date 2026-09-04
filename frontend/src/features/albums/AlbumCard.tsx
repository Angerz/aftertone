import type { Album } from "../../api/types";

const rating = (value: number | null | undefined) => value === null || value === undefined ? "Not rated" : value.toFixed(3);
const initials = (album: Album) => `${album.title[0] ?? "A"}${album.artist[0] ?? "T"}`.toUpperCase();

export function AlbumCard({ album, onOpen }: { album: Album; onOpen: (albumId: number) => void }) {
  return <li><button className="album-card" onClick={() => onOpen(album.id)}><div className={`album-cover cover-tone-${album.id % 5}`} aria-hidden="true"><span>{initials(album)}</span></div><div className="album-card-copy"><strong>{album.title}</strong><span>{album.artist}</span><small>{album.year ?? "Year unknown"} · {album.release_type}</small></div><b className={album.latest_revision ? "album-rating" : "album-rating unrated"}>{rating(album.latest_revision?.final_rating)}</b></button></li>;
}
