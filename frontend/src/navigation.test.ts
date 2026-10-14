import { describe, expect, it } from "vitest";
import { hasArtistDetailTabBack, hasInternalBack, initialAftertoneState, nextAftertoneState } from "./navigation";

describe("Aftertone history markers", () => {
  it("marks a direct entry without inventing a previous internal page", () => {
    expect(initialAftertoneState(null)).toEqual({ aftertone: true, internalBack: false });
    expect(hasInternalBack(initialAftertoneState(null))).toBe(false);
  });
  it("marks normal navigation as safe to return internally", () => expect(hasInternalBack(nextAftertoneState({ aftertone: true }))).toBe(true));
  it("preserves the original return context when an editor route is replaced", () => {
    const origin = nextAftertoneState(initialAftertoneState(null));
    expect(initialAftertoneState(origin)).toEqual({ aftertone: true, internalBack: true });
  });
  it("marks tab transitions separately so contextual Back can restore prior tabs first", () => {
    expect(hasArtistDetailTabBack({ ...nextAftertoneState(null), artistDetailTab: true })).toBe(true);
    expect(hasArtistDetailTabBack(nextAftertoneState(null))).toBe(false);
  });
});
