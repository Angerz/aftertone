import { Fragment } from "react";
import type { Artist } from "../../api/types";
import { trackArtistCreditGroups } from "./trackArtistCredits";
import "./trackArtistCredits.css";

export function TrackArtistCredits({ primary, featured = [], context = [], onArtist, linked = true }: {
  primary: Artist[];
  featured?: Artist[];
  context?: Pick<Artist, "id">[];
  onArtist?: (id: number) => void;
  linked?: boolean;
}) {
  const groups = trackArtistCreditGroups(primary, featured, context);
  if (!groups.length) return null;
  return <span className="track-artist-credits">{groups.map((group, groupIndex) => <Fragment key={group.prefix}>
    {groupIndex > 0 && " · "}{group.prefix}{group.artists.map((artist, index) => <Fragment key={artist.id}>
      {index > 0 && (index === group.artists.length - 1 ? " & " : ", ")}
      {linked ? <a className="artist-link" href={`/artists/${artist.id}`} onClick={(event) => {
        if (!onArtist || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onArtist(artist.id);
      }}>{artist.name}</a> : artist.name}
    </Fragment>)}
  </Fragment>)}</span>;
}
