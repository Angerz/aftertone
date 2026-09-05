import { describe, expect, it } from "vitest";
import { formatArtistNames } from "./artistDisplay";

describe("formatArtistNames", () => {
  it("formats ordered artist credits without parsing artist names", () => {
    expect(formatArtistNames([{ id: 1, name: "A" }])).toBe("A");
    expect(formatArtistNames([{ id: 1, name: "A" }, { id: 2, name: "B" }])).toBe("A & B");
    expect(formatArtistNames([{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "C" }])).toBe("A, B & C");
  });
});
