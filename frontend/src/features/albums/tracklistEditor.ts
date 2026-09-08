import type { TrackUpdate } from "../../api/types";

export function parseTracklistText(value: string): TrackUpdate[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((title) => ({ disc_number: 1, title }));
}

export function addTrackToDisc(tracks: TrackUpdate[], discNumber: number): TrackUpdate[] {
  return [...tracks, { disc_number: discNumber, title: "" }];
}

export function moveTrackWithinDisc(tracks: TrackUpdate[], index: number, direction: -1 | 1): TrackUpdate[] {
  const discNumber = tracks[index]?.disc_number;
  const discIndexes = tracks.flatMap((track, itemIndex) => track.disc_number === discNumber ? [itemIndex] : []);
  const target = discIndexes[discIndexes.indexOf(index) + direction];
  if (target === undefined) return tracks;
  const next = [...tracks]; [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function canUseDiscCount(tracks: TrackUpdate[], discCount: number): boolean {
  return tracks.every((track) => track.disc_number <= discCount);
}
