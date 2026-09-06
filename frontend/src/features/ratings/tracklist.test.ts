import { describe, expect, it } from "vitest";
import { parseTracklist } from "./tracklist";

describe("parseTracklist", () => {
  it.each([
    ["Track 1\nTrack 2", ["Track 1", "Track 2"]],
    ["Track 1\n\nTrack 2", ["Track 1", "Track 2"]],
    ["\nTrack 1\n\nTrack 2\n", ["Track 1", "Track 2"]],
    ["Track 1\n   \nTrack 2", ["Track 1", "Track 2"]],
  ])("parses %j", (value, expected) => {
    expect(parseTracklist(value)).toEqual(expected);
  });
});
