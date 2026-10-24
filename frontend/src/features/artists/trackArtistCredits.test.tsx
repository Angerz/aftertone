import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Artist } from "../../api/types";
import { TrackArtistCredits } from "./TrackArtistCredits";
import { formatTrackArtistCredits, trackArtistCreditGroups } from "./trackArtistCredits";

const artist = (id: number, name = `Artist ${id}`): Artist => ({ id, name });
const [a, b, c, d] = [artist(1, "A"), artist(2, "B"), artist(3, "C"), artist(4, "D")];
const text = (primary: Artist[], featured: Artist[], context: Artist[]) => trackArtistCreditGroups(primary, featured, context)
  .map(({ prefix, artists }) => prefix + artists.map(({ name }) => name).join(" & ")).join(" · ");

describe("track artist attribution", () => {
  it.each([
    ["inherited primary", [a], [], [a], ""],
    ["explicit matching primary", [a], [], [a], ""],
    ["additional primary", [a, b], [], [a], "with B"],
    ["featured collaborator", [a], [b], [a], "feat. B"],
    ["different primary", [b], [], [a], "B"],
    ["multiple different primaries", [b, c], [], [a], "B & C"],
    ["multiple featured collaborators", [a], [b, c], [a], "feat. B & C"],
    ["mixed collaborators", [a, b], [c, d], [a], "with B · feat. C & D"],
    ["same complete album set in another order", [b, a], [], [a, b], ""],
    ["subset of multi-artist album", [a], [c], [a, b], "A · feat. C"],
    ["partial overlap does not invent album artists", [a, c], [d], [a, b], "A & C · feat. D"],
    ["additional artist on multi-artist album", [c, b, a], [], [a, b], "with C"],
    ["Various Artists is not a fallback for explicit credits", [b], [c], [artist(9, "Various Artists")], "B · feat. C"],
    ["deduplication does not rewrite relationships", [a, b, b], [b, c, c], [a], "with B · feat. C"],
    ["inherited/featured overlap", [a, b], [b], [a, b], ""],
  ])("formats %s", (_label, primary, featured, context, expected) => {
    expect(text(primary as Artist[], featured as Artist[], context as Artist[])).toBe(expected);
  });

  it("compares IDs, not names, and preserves stored credit order", () => {
    expect(text([artist(2, "A"), c], [], [a])).toBe("A & C");
    expect(formatTrackArtistCredits([c, b, a], [d])).toBe("C, B & A · feat. D");
    const primary = Object.freeze([a, b]) as unknown as Artist[];
    const featured = Object.freeze([b, c]) as unknown as Artist[];
    expect(text(primary, featured, [a])).toBe("with B · feat. C");
    expect(primary).toEqual([a, b]);
    expect(featured).toEqual([b, c]);
  });

  it("keeps linked artists accessible and omits empty wrappers", () => {
    const markup = renderToStaticMarkup(<TrackArtistCredits primary={[b, c]} featured={[d]} context={[a]} />);
    expect(markup).toContain('href="/artists/2"');
    expect(markup).toContain('href="/artists/3"');
    expect(markup).toContain('href="/artists/4"');
    expect(markup).toContain("feat. ");
    expect(renderToStaticMarkup(<TrackArtistCredits primary={[a]} context={[a]} />)).toBe("");
  });

  it("uses non-interactive text inside row buttons without dropping collaborators", () => {
    const markup = renderToStaticMarkup(<button><TrackArtistCredits primary={[a, b]} featured={[c]} linked={false} /></button>);
    expect(markup).toContain("A &amp; B · feat. C");
    expect(markup).not.toContain("<a ");
    expect(markup.match(/<button/g)).toHaveLength(1);
  });
});
