import type { Album, RatingRevisionDetail } from "../../api/types";
import { TrackArtistCredits } from "../artists/TrackArtistCredits";
import { trackArtistCreditGroups } from "../artists/trackArtistCredits";
import { getRatingTier } from "./ratingTier";

export function AlbumTrackList({ album, revision, pendingLegacy, onArtist }: {
  album: Album;
  revision: RatingRevisionDetail | null;
  pendingLegacy: boolean;
  onArtist: (id: number) => void;
}) {
  const discs = Array.from({ length: album.disc_count }, (_, index) => index + 1);
  return <div id="tracks-panel" role="tabpanel" aria-labelledby="tracks-tab" className="track-view-panel">{discs.map((disc) => {
    const tracks = album.tracks.filter((track) => track.disc_number === disc);
    return <section className="track-disc" key={disc}>{album.disc_count > 1 && <h3>Disc {disc}</h3>}<ol>{tracks.map((track) => {
      const snapshot = revision?.tracks.find((item) => item.track_id === track.id);
      const tier = getRatingTier(snapshot?.score);
      const primary = track.uses_album_artists ? album.artists : track.primary_artists;
      const hasCredits = trackArtistCreditGroups(primary, track.featured_artists, album.artists).length > 0;
      return <li key={track.id}><div>
        <span>{String(track.position).padStart(2, "0")}</span><strong>{track.title}</strong>
        <b className={tier ? `track-score rating-${tier}` : "track-score"}>{snapshot ? snapshot.score === null ? "Unrated" : snapshot.score.toFixed(1) : "—"}</b>
      </div>{hasCredits && <p className="track-features"><TrackArtistCredits primary={primary} featured={track.featured_artists} context={album.artists} onArtist={onArtist} /></p>}
        {snapshot && !snapshot.include_in_pre_rating && <p className="album-track-pre-status">Excluded from PRE</p>}
        {snapshot?.notes && <p>{snapshot.notes}</p>}
      </li>;
    })}</ol></section>;
  })}{!album.tracks.length && <p>{pendingLegacy ? "Tracklist not reconciled yet." : "No tracks recorded."}</p>}</div>;
}
