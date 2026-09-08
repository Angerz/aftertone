import type { TrackRatingRevision } from "../../api/types";

export interface MomentumPoint {
  discNumber: number;
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
  const points = [...trackRatings].sort((left, right) => left.disc_number - right.disc_number || left.position - right.position).map(({ disc_number, position, title, score }) => ({ discNumber: disc_number, position, title, score }));
  const rated = points.filter((point): point is MomentumPoint & { score: number } => point.score !== null);
  const segments: MomentumPoint[][] = [];
  let segment: MomentumPoint[] = [];
  for (const point of points) {
    if (point.score === null) { if (segment.length) segments.push(segment); segment = []; } else { segment.push(point); }
  }
  if (segment.length) segments.push(segment);
  return { points, segments, yMin: rated.some((point) => point.score < 5) ? 0 : 5, yMax: 10, preRating };
}
