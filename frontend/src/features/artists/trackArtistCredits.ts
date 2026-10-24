import type { Artist } from "../../api/types";
import { formatArtistNames } from "./artistDisplay";

export interface TrackCreditGroup {
  prefix: "" | "with " | "feat. ";
  artists: Artist[];
}

function uniqueArtists(artists: Artist[]): Artist[] {
  const seen = new Set<number>();
  return artists.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Effective primaries come from the API; context affects presentation only. */
export function trackArtistCreditGroups(primaryArtists: Artist[], featuredArtists: Artist[] = [], contextArtists: Pick<Artist, "id">[] = []): TrackCreditGroup[] {
  const primary = uniqueArtists(primaryArtists);
  const primaryIds = new Set(primary.map(({ id }) => id));
  const contextIds = new Set(contextArtists.map(({ id }) => id));
  const includesContext = contextIds.size > 0 && [...contextIds].every((id) => primaryIds.has(id));
  const extras = primary.filter(({ id }) => !contextIds.has(id));
  const displayedPrimary = includesContext ? extras : primary;
  const featured = uniqueArtists(featuredArtists).filter(({ id }) => !primaryIds.has(id));
  const groups: TrackCreditGroup[] = [];
  if (displayedPrimary.length) groups.push({ prefix: includesContext ? "with " : "", artists: displayedPrimary });
  if (featured.length) groups.push({ prefix: "feat. ", artists: featured });
  return groups;
}

export function formatTrackArtistCredits(primary: Artist[], featured: Artist[] = []): string {
  return trackArtistCreditGroups(primary, featured).map((group) => group.prefix + formatArtistNames(group.artists)).join(" · ");
}
