import type { TrackUpdate } from "../../api/types";

export function parseTracklistText(value: string): TrackUpdate[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((title) => ({ title }));
}
