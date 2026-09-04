import type { Album } from "../../api/types";
import { AlbumCover } from "./AlbumCover";

const rating = (value: number | null | undefined) => value === null || value === undefined ? "Not rated" : value.toFixed(3);
export function AlbumCard({ album, onOpen }: { album: Album; onOpen: (albumId: number) => void }) {
  return <li><button className="album-card" onClick={() => onOpen(album.id)}><AlbumCover album={album} /><div className="album-card-copy"><strong>{album.title}</strong><span>{album.artist}</span><small>{album.year ?? "Year unknown"} · {album.release_type}</small></div><b className={album.latest_revision ? "album-rating" : "album-rating unrated"}>{rating(album.latest_revision?.final_rating)}</b></button></li>;
}
