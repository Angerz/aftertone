import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RatingEditorPreview } from "./RatingEditorPreview";
import { formatPercentage } from "./ratingFormatting";
import type { RatingPreview } from "./ratingPreviewCalculator";

describe("bad-experience percentage presentation", () => {
  it.each([[null, "—"], [0, "0.00 %"], [0.1, "10.00 %"], [1, "100.00 %"]] as const)("formats ratio %j as %s", (ratio, expected) => {
    expect(formatPercentage(ratio)).toBe(expected);
  });

  it("uses one percentage value for all viewport sizes without changing the impact or final score", () => {
    const preview: RatingPreview = { preRating: 7.75, badExperience: 0.1, coherenceComponent: 0.180625, badExperienceComponent: -0.005, emotionComponent: -0.045, finalRating: 7.880625 };
    const original = { ...preview };
    const markup = renderToStaticMarkup(<RatingEditorPreview preview={preview} saved={null} coherence={8.5} emotion={3.2} />);
    expect(markup).toContain("<dt>Bad experience</dt><dd>10.00 %</dd>");
    expect(markup).toContain("-0.005");
    expect(markup).toContain("7.881");
    expect(preview).toEqual(original);
  });
});
