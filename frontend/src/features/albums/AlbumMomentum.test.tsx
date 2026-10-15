import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { RatingRevisionDetail } from "../../api/types";
import { AlbumMomentum } from "./AlbumMomentum";

const revision = (scores: (number | null)[]): RatingRevisionDetail => ({
  id: 1, album_id: 1, created_at: "2026-01-01T00:00:00Z", pre_rating: 4.75,
  coherence: 5, emotion: 5, bad_experience: 0, final_rating: 4.75,
  coherence_notes: null, emotion_notes: null, album_notes: null,
  rating_breakdown: { pre_contribution: 4.75, coherence_contribution: 0, emotion_contribution: 0, bad_experience_contribution: 0, final_rating: 4.75 },
  tracks: scores.map((score, index) => ({ track_id: index + 1, title: `Track ${index + 1}`, disc_number: 1, position: index + 1, score, include_in_pre_rating: true, notes: null })),
});

it("renders actual zero and null scores distinctly, preserving the unrated gap and PRE", () => {
  const markup = renderToStaticMarkup(<AlbumMomentum revision={revision([0, null, 9.5])} />);
  expect(markup).toContain("Track 1: 0.0");
  expect(markup).toContain("Track 2: Unrated");
  expect(markup).toContain("Track 3: 9.5");
  expect(markup).toContain("PRE 4.750");
  expect(markup).not.toContain("<polyline");
  expect(markup).toContain('class="momentum-unrated-span"');
});

it("does not create a chart when every track is unrated", () => {
  const markup = renderToStaticMarkup(<AlbumMomentum revision={revision([null, null])} />);
  expect(markup).toContain("No rated tracks yet.");
  expect(markup).not.toContain("<svg");
});
