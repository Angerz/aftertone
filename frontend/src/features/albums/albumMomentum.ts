import type { TrackRatingRevision } from "../../api/types";

export interface MomentumPoint {
  position: number;
  title: string;
  score: number | null;
}

export interface AlbumMomentumData {
  points: MomentumPoint[];
  segments: MomentumPoint[][];
  yMin: 0 | 5;
  yMax: 10;
  preRating: number | null;
}

export function buildAlbumMomentumData(trackRatings: TrackRatingRevision[], preRating: number | null): AlbumMomentumData {
  const points = [...trackRatings].sort((left, right) => left.position - right.position).map(({ position, title, score }) => ({ position, title, score }));
  const rated = points.filter((point): point is MomentumPoint & { score: number } => point.score !== null);
  const segments: MomentumPoint[][] = [];
  let segment: MomentumPoint[] = [];
  for (const point of points) {
    if (point.score === null) { if (segment.length) segments.push(segment); segment = []; } else { segment.push(point); }
  }
  if (segment.length) segments.push(segment);
  return { points, segments, yMin: rated.some((point) => point.score < 5) ? 0 : 5, yMax: 10, preRating };
}
