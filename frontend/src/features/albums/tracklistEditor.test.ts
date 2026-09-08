import { expect, it } from "vitest";
import { parseTracklistText } from "./tracklistEditor";

it("parses pasted track titles without removing editable blank lines first", () => {
  expect(parseTracklistText("Track 1\n\n Track 2 \n")).toEqual([{ title: "Track 1" }, { title: "Track 2" }]);
});
