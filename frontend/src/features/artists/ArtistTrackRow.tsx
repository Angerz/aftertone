import type { ArtistTrack } from "../../api/types";
import { AlbumCover } from "../albums/AlbumCover";
import { formatLibraryRating } from "../albums/library";
import { getRatingTier } from "../albums/ratingTier";
import { TrackArtistCredits } from "./TrackArtistCredits";
import { trackArtistCreditGroups } from "./trackArtistCredits";

export function ArtistTrackRow({ track, position, artistId, onAlbum, onArtist, coverClassName = "artist-top-track-cover" }: {
  track: ArtistTrack;
  position: number;
  artistId: number;
  onAlbum: (id: number) => void;
  onArtist?: (id: number) => void;
  coverClassName?: string;
}) {
  const tier = getRatingTier(track.score);
  const primary = track.primary_artists ?? [];
  const context = [{ id: artistId }];
  const hasCredits = trackArtistCreditGroups(primary, track.featured_artists, context).length > 0;
  return <li><span className="artist-top-track-rank">{String(position).padStart(2, "0")}</span>
    <AlbumCover album={{ id: track.album_id, title: track.album_title, artists: [], cover_url: track.album_cover_url }} className={coverClassName} />
    <span className="artist-top-track-copy"><strong>{track.title}</strong>
      {hasCredits && <small><TrackArtistCredits primary={primary} featured={track.featured_artists} context={context} onArtist={onArtist} /></small>}
      <small title={`Disc ${track.disc_number}, track ${track.track_position}`}><button className="text-button artist-track-album-link" onClick={() => onAlbum(track.album_id)}>{track.album_title}</button> · {track.album_year ?? "Year unknown"}<span className="visually-hidden"> · Disc {track.disc_number}, track {track.track_position}</span></small>
    </span><b className={tier ? `artist-top-track-score rating-${tier}` : "artist-top-track-score unrated"}>{track.score === null ? "Unrated" : formatLibraryRating(track.score)}</b>
  </li>;
}
