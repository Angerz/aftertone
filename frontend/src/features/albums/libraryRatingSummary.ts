export function shouldShowLibraryRatingSummary(search: string | undefined, unrated = false): boolean {
  return !search?.trim() && !unrated;
}

export function formatLibraryAverage(average: number | null): string {
  return average === null ? "Not rated" : average.toFixed(1);
}

export function ratedProjectLabel(count: number): string {
  return `${count} rated project${count === 1 ? "" : "s"}`;
}
