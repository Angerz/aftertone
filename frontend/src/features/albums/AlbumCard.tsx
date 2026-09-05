import type { Album } from "../../api/types";
import { AlbumCover } from "./AlbumCover";
import { formatArtistNames } from "../artists/artistDisplay";

const rating = (value: number | null | undefined) => value === null || value === undefined ? "Not rated" : value.toFixed(3);
export function AlbumCard({ album, onOpen }: { album: Album; onOpen: (albumId: number) => void }) {
  const legacy = album.latest_revision ? null : album.latest_legacy_rating;
  return <li><button className="album-card" onClick={() => onOpen(album.id)}><AlbumCover album={album} /><div className="album-card-copy"><strong>{album.title}</strong><span>{formatArtistNames(album.artists)}</span><small>{album.year ?? "Year unknown"} · {album.release_type}{album.needs_revisit ? " · Revisit" : ""}</small></div><b className={album.latest_revision || legacy ? "album-rating" : "album-rating unrated"}>{rating(album.latest_revision?.final_rating ?? legacy?.computed_final_rating ?? legacy?.legacy_final_rating)}{legacy && <small>Legacy</small>}</b></button></li>;
}
