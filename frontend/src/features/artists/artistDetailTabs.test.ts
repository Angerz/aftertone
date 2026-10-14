import { describe, expect, it } from "vitest";
import { parseArtistDetailTab } from "./ArtistPage";

describe("artist detail tabs", () => {
  it("restores valid URL tabs and safely defaults invalid values to projects", () => {
    expect(parseArtistDetailTab("?tab=tracks")).toBe("tracks");
    expect(parseArtistDetailTab("?tab=featured")).toBe("featured");
    expect(parseArtistDetailTab("?tab=unknown")).toBe("projects");
    expect(parseArtistDetailTab("")).toBe("projects");
  });
});
