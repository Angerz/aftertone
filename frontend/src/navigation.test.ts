import { describe, expect, it } from "vitest";
import { hasInternalBack, initialAftertoneState, nextAftertoneState } from "./navigation";

describe("Aftertone history markers", () => {
  it("marks a direct entry without inventing a previous internal page", () => {
    expect(initialAftertoneState(null)).toEqual({ aftertone: true, internalBack: false });
    expect(hasInternalBack(initialAftertoneState(null))).toBe(false);
  });
  it("marks normal navigation as safe to return internally", () => expect(hasInternalBack(nextAftertoneState({ aftertone: true }))).toBe(true));
});
