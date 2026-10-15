import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import type { AlbumFacets, AlbumRatingSummary } from "../../api/types";
import { OwnerOnly } from "../auth/Auth";
import type { LibrarySort, LibrarySortDirection } from "./library";
import { libraryFilterSummary, librarySortLabels } from "./libraryFilterSummary";
import { formatLibraryAverage, ratedProjectLabel, shouldShowLibraryRatingSummary } from "./libraryRatingSummary";
import type { LibraryNavigation } from "./pagination";
import { getRatingTier } from "./ratingTier";
import "./libraryControls.css";

interface LibraryControlsProps {
  navigation: LibraryNavigation;
  facets: AlbumFacets;
  summary: AlbumRatingSummary | null;
  summaryLoading: boolean;
  onChange: (next: Partial<LibraryNavigation>) => void;
  onSort: (sort: LibrarySort) => void;
  onDirection: (direction: LibrarySortDirection) => void;
}

function LibraryRatingSummaryBlock({ summary, loading }: { summary: AlbumRatingSummary | null; loading: boolean }) {
  const tier = getRatingTier(summary?.average);
  return <aside className={`library-rating-summary ${tier ? `rating-${tier}` : "unrated"}`} aria-live="polite"><span>Average rating</span><strong>{loading ? "…" : formatLibraryAverage(summary?.average ?? null)}</strong><small>{loading ? "Loading…" : ratedProjectLabel(summary?.rated_count ?? 0)}</small></aside>;
}

export function LibraryControls({ navigation, facets, summary, summaryLoading, onChange, onSort, onDirection }: LibraryControlsProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const decades = Object.keys(facets.decades).map(Number).sort((left, right) => left - right);
  const years = navigation.decade ? facets.decades[String(navigation.decade)] ?? [] : [];
  const showSummary = shouldShowLibraryRatingSummary(navigation.search, navigation.unrated);

  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    setFiltersOpen(false);
    filterButtonRef.current?.focus();
  }

  function onDateStripFocus(event: FocusEvent<HTMLElement>) {
    const button = event.target.closest("button");
    const strip = button?.parentElement;
    if (!button?.matches(":focus-visible") || !strip?.classList.contains("time-filter-row")) return;
    const bounds = strip.getBoundingClientRect();
    const target = button.getBoundingClientRect();
    const padding = getComputedStyle(strip);
    const left = target.left - bounds.left - parseFloat(padding.paddingLeft);
    const right = target.right - bounds.left - strip.clientWidth + parseFloat(padding.paddingRight);
    // Reveal the complete focus ring by scrolling this strip, never the page.
    if (left < 0) strip.scrollLeft += left;
    else if (right > 0) strip.scrollLeft += right;
  }

  // Both compositions share controlled values and handlers; CSS exposes only one.
  const search = <label className="library-search"><span className="library-search-label">Search your library</span><input type="search" value={navigation.search ?? ""} onChange={(event) => onChange({ search: event.target.value || undefined })} placeholder="Title or artist" /></label>;
  const sort = <label>Sort by<select value={navigation.sort} onChange={(event) => onSort(event.target.value as LibrarySort)}>{(Object.entries(librarySortLabels) as [LibrarySort, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
  const direction = <div className="library-direction" role="group" aria-label="Sort direction"><span>Direction</span><div>
    <button type="button" className={navigation.direction === "asc" ? "active" : ""} aria-label="Ascending" title="Ascending" aria-pressed={navigation.direction === "asc"} onClick={() => onDirection("asc")}><span className="library-direction-label">Ascending</span><svg className="library-direction-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 16 16"><path d="M8 13V3m-4 4 4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
    <button type="button" className={navigation.direction === "desc" ? "active" : ""} aria-label="Descending" title="Descending" aria-pressed={navigation.direction === "desc"} onClick={() => onDirection("desc")}><span className="library-direction-label">Descending</span><svg className="library-direction-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 16 16"><path d="M8 3v10m-4-4 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
  </div></div>;
  const status = <section className="status-filter" aria-label="Album status filter"><p className="eyebrow">Status</p><div className="status-filter-row"><OwnerOnly><button className={navigation.revisit ? "active status-revisit" : ""} aria-pressed={navigation.revisit} onClick={() => onChange({ revisit: !navigation.revisit })}>Revisit</button></OwnerOnly><button className={navigation.unrated ? "active" : ""} aria-pressed={navigation.unrated} onClick={() => onChange({ unrated: !navigation.unrated })}>Not rated</button></div></section>;
  const dates = <>
    <div className="time-filter-row"><button className={!navigation.decade ? "active" : ""} aria-pressed={!navigation.decade} onClick={() => onChange({ decade: undefined, year: undefined, month: undefined })}>All years</button>{decades.map((decade) => <button key={decade} className={navigation.decade === decade ? "active" : ""} aria-pressed={navigation.decade === decade} onClick={() => onChange({ decade, year: undefined, month: undefined })}>{decade}s</button>)}</div>
    {navigation.decade && <div className="time-filter-row years"><button className={!navigation.year ? "active" : ""} aria-pressed={!navigation.year} onClick={() => onChange({ year: undefined, month: undefined })}>All {navigation.decade}s</button>{years.map((year) => <button key={year} className={navigation.year === year ? "active" : ""} aria-pressed={navigation.year === year} onClick={() => onChange({ year, month: undefined })}>{year}</button>)}</div>}
    {navigation.month && navigation.year && <p className="library-month-filter">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(navigation.year, navigation.month - 1, 1))}<button className="text-button" onClick={() => onChange({ month: undefined })}>Clear month</button></p>}
  </>;
  const average = showSummary && <LibraryRatingSummaryBlock summary={summary} loading={summaryLoading} />;

  return <>
    <div className="library-desktop-controls">
      <div className="library-controls">{search}{sort}{direction}</div>
      {status}
      <section className="time-filter" aria-label="Release date filter"><div className="time-filter-main"><div>{dates}</div>{average}</div></section>
    </div>
    <div className="library-mobile-controls">
      <div className="library-mobile-toolbar">
        {search}
        <button ref={filterButtonRef} type="button" className="library-filter-toggle" aria-expanded={filtersOpen} aria-controls="library-mobile-filters" onClick={() => setFiltersOpen((open) => !open)}>Filters <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d={filtersOpen ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button>
      </div>
      {!filtersOpen && <p className="library-filter-summary">{libraryFilterSummary(navigation)}</p>}
      <section id="library-mobile-filters" className="library-filter-panel" aria-label="Library filters" hidden={!filtersOpen} onKeyDown={onPanelKeyDown}>
        <div className="library-panel-sort">{sort}{direction}</div>
        {status}
        <section className="time-filter" aria-label="Release date filter" onFocus={onDateStripFocus}><div className="time-filter-main"><div>{dates}</div></div></section>
      </section>
      {average}
    </div>
  </>;
}
