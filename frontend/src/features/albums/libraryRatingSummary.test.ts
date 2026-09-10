import { describe, expect, it } from "vitest";
import { formatLibraryAverage, ratedProjectLabel, shouldShowLibraryRatingSummary } from "./libraryRatingSummary";

describe("Library rating summary helpers", () => {
  it("hides the summary only for a non-blank search", () => {
    expect(shouldShowLibraryRatingSummary(undefined)).toBe(true);
    expect(shouldShowLibraryRatingSummary("   ")).toBe(true);
    expect(shouldShowLibraryRatingSummary("Grace")).toBe(false);
  });

  it("formats the real average to one decimal without the Library-card clamp", () => {
    expect(formatLibraryAverage(10.25)).toBe("10.3");
    expect(formatLibraryAverage(8.764)).toBe("8.8");
    expect(formatLibraryAverage(null)).toBe("Not rated");
  });

  it("uses singular and plural rated-project labels", () => {
    expect(ratedProjectLabel(1)).toBe("1 rated project");
    expect(ratedProjectLabel(0)).toBe("0 rated projects");
    expect(ratedProjectLabel(2)).toBe("2 rated projects");
  });
});
