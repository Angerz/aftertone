import { describe, expect, it } from "vitest";
import { albumTitleSize } from "./albumTitle";

describe("albumTitleSize", () => {
  it("keeps short editorial titles at the normal scale", () => {
    expect(albumTitleSize("Grace")).toBe("normal");
    expect(albumTitleSize("Random Access Memories")).toBe("normal");
  });

  it("reduces long titles without truncating their content", () => {
    expect(albumTitleSize("The Rise and Fall of Ziggy Stardust and the Spiders From Mars")).toBe("long");
    expect(albumTitleSize("A Touch of the Beat Gets You Up on Your Feet Gets You Out and Then Into the Sun")).toBe("very-long");
  });
});
