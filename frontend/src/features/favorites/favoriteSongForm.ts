export const favoriteSongCriteria = [
  ["base_score", "Puntuación", 10, "How good is this song as an isolated musical work?"],
  ["emotional_connection", "Conexión emocional", 5, "How different would my life be without this song?"],
  ["replay_value", "Replay value", 5, "How likely am I to want to hear it completely?"],
  ["originality", "Originalidad", 5, "How singular does this song feel based on everything I have personally heard?"],
] as const;

export type FavoriteSongCriterion = (typeof favoriteSongCriteria)[number][0];
export type FavoriteSongForm = Record<FavoriteSongCriterion, string> & { genre: string; notes: string };

export function validateFavoriteSongCriteria(form: Record<FavoriteSongCriterion, string>) {
  const errors: Partial<Record<FavoriteSongCriterion, string>> = {};
  const values = {} as Record<FavoriteSongCriterion, number>;
  for (const [key, , max] of favoriteSongCriteria) {
    if (!form[key].trim()) {
      errors[key] = "Enter a value.";
      continue;
    }
    const value = Number(form[key]);
    if (!Number.isFinite(value) || value < 0 || value > max) {
      errors[key] = `Enter a number from 0 to ${max}.`;
      continue;
    }
    values[key] = value;
  }
  return { errors, values: Object.keys(errors).length ? null : values };
}
