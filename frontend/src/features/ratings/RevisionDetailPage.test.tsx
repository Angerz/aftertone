import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Album, RatingRevisionDetail } from "../../api/types";
import { RevisionDetailPage } from "./RevisionDetailPage";

const album: Album = {
  id: 1, title: "Current album", artists: [{ id: 1, name: "Synthetic artist" }],
  year: 2024, release_type: "album", disc_count: 1, tracks: [], latest_revision: null,
  cover_url: null, needs_revisit: false, revisit_reason: null, revisit_marked_at: null,
  latest_legacy_rating: null,
};

const revision: RatingRevisionDetail = {
  id: 7, album_id: 1, created_at: "2026-10-15T12:00:00Z", pre_rating: 7.65,
  coherence: 8.5, coherence_notes: "Saved coherence note", emotion: 3.2,
  emotion_notes: "Saved emotion note", album_notes: "Saved album note",
  bad_experience: 0.1, final_rating: 7.781,
  rating_breakdown: { pre_contribution: 7.65, coherence_contribution: 0.180625,
    bad_experience_contribution: -0.005, emotion_contribution: -0.045, final_rating: 7.781 },
  tracks: [
    { track_id: 1, title: "Original historical track", disc_number: 1, position: 1,
      score: 0, include_in_pre_rating: true, notes: "Saved track note" },
    { track_id: 2, title: "Unrated historical track", disc_number: 1, position: 2,
      score: null, include_in_pre_rating: false, notes: null },
  ],
};

const renderRevision = (snapshot: RatingRevisionDetail) => renderToStaticMarkup(
  <RevisionDetailPage album={album} revision={snapshot} onBack={() => undefined} />,
);

describe("historical revision percentage presentation", () => {
  it.each([[0.1, "10.00 %"], [0, "0.00 %"], [1, "100.00 %"], [null, "—"]] as const)(
    "displays stored ratio %j as %s", (ratio, expected) => {
      expect(renderRevision({ ...revision, bad_experience: ratio })).toContain(
        `<dt>Bad experience</dt><dd>${expected}</dd>`,
      );
    },
  );

  it("preserves the historical scores, notes, inclusion flags and input snapshot", () => {
    const original = structuredClone(revision);
    const markup = renderRevision(revision);
    expect(markup).toContain("<dt>PRE</dt><dd>7.650</dd>");
    expect(markup).toContain("<dt>Final rating</dt><dd>7.781</dd>");
    expect(markup).toContain("Original historical track");
    expect(markup).toContain("<strong>0.0</strong> · Included in PRE");
    expect(markup).toContain("<strong>Unrated</strong> · Excluded from PRE");
    for (const note of ["Saved coherence note", "Saved emotion note", "Saved album note", "Saved track note"]) {
      expect(markup).toContain(note);
    }
    expect(revision).toEqual(original);
  });
});
