export const favoriteSongScore = (base: number, emotional: number, replay: number, originality: number) => base * .25 + emotional * 1.1 + replay * .3 + originality * .1;
