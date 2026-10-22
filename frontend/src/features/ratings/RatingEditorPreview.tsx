import type { RatingRevisionDetail } from "../../api/types";
import type { RatingPreview } from "./ratingPreviewCalculator";
import { getRatingTier } from "../albums/ratingTier";
import { formatPercentage } from "./ratingFormatting";

const fmt = (value: number | null, digits = 3) => value === null ? "—" : value.toFixed(digits);
const impact = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${fmt(value)}`;
function Impact({ value }: { value: number | null }) {
  return <dd className={`rating-preview-mobile${value === null || value === 0 ? "" : value > 0 ? " rating-impact-positive" : " rating-impact-negative"}`}><span className="visually-hidden">Impact </span>{impact(value)}</dd>;
}

export function RatingEditorPreview({ preview, saved, coherence, emotion }: {
  preview: RatingPreview | null; saved: RatingRevisionDetail | null; coherence: number | null; emotion: number | null;
}) {
  const summary = saved ? { preRating: saved.pre_rating, badExperience: saved.bad_experience, finalRating: saved.final_rating,
    coherenceComponent: saved.rating_breakdown.coherence_contribution,
    badExperienceComponent: saved.rating_breakdown.bad_experience_contribution,
    emotionComponent: saved.rating_breakdown.emotion_contribution } : preview;
  const tier = getRatingTier(summary?.finalRating);
  return <aside className={`summary rating-editor-summary${tier ? ` rating-${tier}` : ""}`}>
    <p className="eyebrow">Rating summary</p>
    <p className="summary-date">Provisional · recalculated by the server when saved</p>
    <dl>
      <div className="rating-preview-mobile rating-preview-columns" aria-hidden="true"><dt>Parameter</dt><dd>Value</dd><dd>Impact</dd></div>
      <div><dt>PRE</dt><dd>{fmt(summary?.preRating ?? null)}</dd><dd className="rating-preview-mobile">Base</dd></div>
      <div><dt>Coherence</dt><dd>{fmt(coherence, 1)}</dd><Impact value={summary?.coherenceComponent ?? null} /></div>
      <div><dt>Bad experience</dt><dd>{formatPercentage(summary?.badExperience ?? null)}</dd><Impact value={summary?.badExperienceComponent ?? null} /></div>
      <div><dt>Emotion</dt><dd>{fmt(emotion, 1)}</dd><Impact value={summary?.emotionComponent ?? null} /></div>
      <div className="final"><dt>Provisional final</dt><dd>{fmt(summary?.finalRating ?? null)}</dd></div>
    </dl>
    {!preview && !saved && <p className="summary-note">Include at least one track and enter valid scores to calculate the rating.</p>}
  </aside>;
}
