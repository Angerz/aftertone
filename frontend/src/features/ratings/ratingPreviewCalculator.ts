/**
 * Instant UI feedback only. The POST /revisions response is always authoritative.
 * Kept deliberately isolated from API payload construction and persistence.
 */
export interface PreviewTrack { score: number; includeInPreRating: boolean }
export interface RatingPreview { preRating: number | null; badExperience: number | null; emotionComponent: number | null; finalRating: number | null }

export function ratingPreviewCalculator(tracks: PreviewTrack[], coherence: number, emotion: number): RatingPreview {
  const included = tracks.filter((track) => track.includeInPreRating);
  if (!included.length) return { preRating: null, badExperience: null, emotionComponent: null, finalRating: null };
  const preRating = included.reduce((total, track) => total + track.score, 0) / included.length;
  const badExperience = included.reduce((total, track) => total + (track.score < 5 ? 1 : track.score < 7 ? 0.5 : 0), 0) / included.length;
  const coherenceComponent = (coherence / 10) ** 2 * 0.25;
  let emotionComponent = (emotion - 5) / 100 * 2.5;
  if (emotion > 5) emotionComponent *= 1 - badExperience;
  return { preRating, badExperience, emotionComponent, finalRating: preRating + coherenceComponent - 0.5 * badExperience ** 2 + emotionComponent };
}
