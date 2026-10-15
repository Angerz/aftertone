export type EditableTrackScore = string | null;

export function hasTrackScore(score: EditableTrackScore): boolean {
  return score !== null && score !== "";
}

export function trackScoreInRange(score: EditableTrackScore): boolean {
  const value = Number(score);
  return hasTrackScore(score) && Number.isFinite(value) && value >= 0 && value <= 10;
}

export function ratingScoreErrorMessage(score: EditableTrackScore): string | null {
  if (trackScoreInRange(score)) return null;
  return hasTrackScore(score) ? "Enter a number from 0 to 10." : "A score is required.";
}

export function trackScoreIsValid(score: EditableTrackScore, includedInPre: boolean): boolean {
  return includedInPre ? trackScoreInRange(score) : !hasTrackScore(score) || trackScoreInRange(score);
}

export function shouldShowTrackScoreError(score: EditableTrackScore, includedInPre: boolean, touched: boolean, submitAttempted: boolean): boolean {
  return (touched || submitAttempted) && !trackScoreIsValid(score, includedInPre);
}

export function scoreForRevision(score: EditableTrackScore): number | null {
  return hasTrackScore(score) ? Number(score) : null;
}
