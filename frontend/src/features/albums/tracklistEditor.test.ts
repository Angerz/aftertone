import { expect, it } from "vitest";
import { addTrackToDisc, canUseDiscCount, moveTrackWithinDisc, parseTracklistText } from "./tracklistEditor";

it("parses pasted track titles without removing editable blank lines first", () => {
  expect(parseTracklistText("Track 1\n\n Track 2 \n")).toEqual([{ disc_number: 1, title: "Track 1" }, { disc_number: 1, title: "Track 2" }]);
});

it("adds and reorders tracks within their own disc", () => {
  const tracks = [{ id: 1, disc_number: 1, title: "One" }, { id: 2, disc_number: 2, title: "Two" }, { id: 3, disc_number: 2, title: "Three" }];
  expect(addTrackToDisc(tracks, 2).at(-1)).toEqual({ disc_number: 2, title: "" });
  expect(moveTrackWithinDisc(tracks, 2, -1).map((track) => track.title)).toEqual(["One", "Three", "Two"]);
  expect(canUseDiscCount(tracks, 1)).toBe(false);
});
