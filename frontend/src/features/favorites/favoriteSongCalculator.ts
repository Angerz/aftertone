export const favoriteSongWeights = {
  base_score: .25,
  emotional_connection: 1.1,
  replay_value: .3,
  originality: .1,
} as const;

export const favoriteSongScore = (base: number, emotional: number, replay: number, originality: number) => base * favoriteSongWeights.base_score + emotional * favoriteSongWeights.emotional_connection + replay * favoriteSongWeights.replay_value + originality * favoriteSongWeights.originality;
