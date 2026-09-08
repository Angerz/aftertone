export type RatingTier = "low" | "mid" | "high";

export function getRatingTier(value: number | null | undefined): RatingTier | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value >= 7 ? "high" : value >= 5 ? "mid" : "low";
}

export function getDisplayedRatingTier(value: number | null | undefined): RatingTier | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return getRatingTier(Math.round(value * 10) / 10);
}
