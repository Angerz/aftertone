import { getDisplayedRatingTier, type RatingTier } from "./ratingTier";

export interface LibraryRatingMeter {
  percent: number;
  tier: RatingTier;
}

export function getLibraryRatingMeter(value: number | null | undefined): LibraryRatingMeter | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;

  const percent = Number((Math.max(0, Math.min(10, value)) * 10).toFixed(2));
  return { percent, tier: getDisplayedRatingTier(value)! };
}

export function LibraryRatingBar({ value, title }: { value: number; title?: string }) {
  const meter = getLibraryRatingMeter(value);
  if (!meter) return null;

  return <span className={`library-rating-bar ${meter.tier}`} title={title} aria-label={`Rating meter: ${meter.percent}/100`}>
    <span className="library-rating-bar-fill" style={{ width: `${meter.percent}%` }} />
  </span>;
}
