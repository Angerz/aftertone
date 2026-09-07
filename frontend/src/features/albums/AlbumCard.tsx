import type { Album } from "../../api/types";
import { AlbumCover } from "./AlbumCover";
import { formatArtistNames } from "../artists/artistDisplay";
import { formatLibraryRating } from "./library";
import { LibraryRatingBar } from "./LibraryRatingBar";

export function AlbumCard({ album, onOpen }: { album: Album; onOpen: (albumId: number) => void }) {
  const legacy = album.latest_revision ? null : album.latest_legacy_rating;
  const finalRating = album.latest_revision?.final_rating ?? legacy?.computed_final_rating ?? legacy?.legacy_final_rating;
  const isRated = finalRating !== null && finalRating !== undefined;
  const detailedRating = isRated ? finalRating.toFixed(3) : undefined;
  return <li><button className="album-card" onClick={() => onOpen(album.id)}><AlbumCover album={album} /><div className="album-card-copy"><strong>{album.title}</strong><span>{formatArtistNames(album.artists)}</span><small>{album.year ?? "Year unknown"} · {album.release_type}{album.needs_revisit ? " · Revisit" : ""}</small></div><div className={isRated ? "album-rating" : "album-rating unrated"}>{isRated && <LibraryRatingBar value={finalRating} title={detailedRating} />}<b title={detailedRating}>{isRated ? formatLibraryRating(finalRating) : "Not rated"}{legacy && <small>Legacy</small>}</b></div></button></li>;
}
