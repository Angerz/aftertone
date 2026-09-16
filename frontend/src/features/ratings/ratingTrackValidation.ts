export type EditableTrackScore = string | null;

export function hasTrackScore(score: EditableTrackScore): boolean {
  return score !== null && score !== "";
}

export function trackScoreInRange(score: EditableTrackScore): boolean {
  const value = Number(score);
  return hasTrackScore(score) && Number.isFinite(value) && value >= 0 && value <= 10;
}

export function trackScoreIsValid(score: EditableTrackScore, includedInPre: boolean): boolean {
  return includedInPre ? trackScoreInRange(score) : !hasTrackScore(score) || trackScoreInRange(score);
}

export function scoreForRevision(score: EditableTrackScore): number | null {
  return hasTrackScore(score) ? Number(score) : null;
}
