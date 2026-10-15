import type { LibrarySort } from "./library";
import type { LibraryNavigation } from "./pagination";

export const librarySortLabels: Record<LibrarySort, string> = {
  rating: "Rating",
  recent: "Date rated",
  year: "Release year",
  artist: "Artist",
  title: "Title",
};

export function libraryFilterSummary(navigation: LibraryNavigation): string {
  const filters: string[] = [];
  if (navigation.search?.trim()) filters.push("Search results");
  if (navigation.revisit) filters.push("Revisit");
  if (navigation.unrated) filters.push("Not rated");
  if (navigation.year && navigation.month) {
    filters.push(new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(navigation.year, navigation.month - 1, 1)));
  } else if (navigation.year) {
    filters.push(String(navigation.year));
  } else if (navigation.decade) {
    filters.push(`${navigation.decade}s`);
  }
  return [`${librarySortLabels[navigation.sort]}, ${navigation.direction === "asc" ? "ascending" : "descending"}`, ...(filters.length ? filters : ["All albums"])].join(" · ");
}
