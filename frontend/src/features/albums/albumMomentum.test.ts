import { describe, expect, it } from "vitest";
import { buildAlbumMomentumData } from "./albumMomentum";

const tracks = (...scores: Array<number | null>) => scores.map((score, index) => ({ track_id: index + 1, disc_number: 1, position: index + 1, title: `Track ${index + 1}`, score, include_in_pre_rating: true, notes: null }));

describe("buildAlbumMomentumData", () => {
  it("preserves position order and makes one continuous rated segment", () => { const data = buildAlbumMomentumData([...tracks(8, 9)].reverse(), 8.5); expect(data.points.map((point) => point.position)).toEqual([1, 2]); expect(data.segments).toHaveLength(1); expect(data.preRating).toBe(8.5); });
  it("breaks segments for one or consecutive unrated tracks", () => { expect(buildAlbumMomentumData(tracks(8, null, 9), null).segments.map((segment) => segment.length)).toEqual([1, 1]); expect(buildAlbumMomentumData(tracks(8, null, null, 9), null).segments.map((segment) => segment.length)).toEqual([1, 1]); });
  it("handles unrated tracks at either end and all-unrated data", () => { expect(buildAlbumMomentumData(tracks(null, 8), null).segments).toHaveLength(1); expect(buildAlbumMomentumData(tracks(8, null), null).segments).toHaveLength(1); expect(buildAlbumMomentumData(tracks(null, null), null).segments).toEqual([]); });
  it("uses the dynamic vertical scale", () => { expect(buildAlbumMomentumData(tracks(5, 9), null).yMin).toBe(5); expect(buildAlbumMomentumData(tracks(4.9, 9), null).yMin).toBe(0); expect(buildAlbumMomentumData(tracks(9, null, 8), null).yMin).toBe(5); });
  it("flattens multi-disc tracks by disc and then position", () => { const data = buildAlbumMomentumData([{ ...tracks(8)[0], disc_number: 2, position: 1, title: "Disc two" }, { ...tracks(9)[0], disc_number: 1, position: 2, title: "Disc one, two" }, { ...tracks(7)[0], disc_number: 1, position: 1, title: "Disc one, one" }], null); expect(data.points.map((point) => point.title)).toEqual(["Disc one, one", "Disc one, two", "Disc two"]); });
});
