import { useRef, useState, type KeyboardEvent } from "react";
import type { ArtistListSort, ArtistSortDirection } from "../../api/artists";
import type { ArtistFilter } from "./artistMaintenance";
import { artistSortOptions } from "./artistSorting";
import "./artistCatalogue.css";

const scopeLabels: Record<ArtistFilter, string> = {
  primary: "Primary", all: "All artists", featuring: "Featuring only",
  active: "Active", inactive: "Inactive", unused: "Unused",
};

export function artistCatalogueSummary(sort: ArtistListSort, direction: ArtistSortDirection, filter: ArtistFilter, search: string): string {
  return [
    `${artistSortOptions.find((option) => option.value === sort)?.label}, ${direction === "asc" ? "ascending" : "descending"}`,
    scopeLabels[filter],
    ...(search.trim() ? ["Search results"] : []),
  ].join(" · ");
}

interface ArtistCatalogueControlsProps {
  search: string;
  sort: ArtistListSort;
  direction: ArtistSortDirection;
  filter: ArtistFilter;
  onSearch: (value: string) => void;
  onSort: (value: ArtistListSort) => void;
  onDirection: (value: ArtistSortDirection) => void;
  onFilter: (value: ArtistFilter) => void;
}

export function ArtistCatalogueControls({ search, sort, direction, filter, onSearch, onSort, onDirection, onFilter }: ArtistCatalogueControlsProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    setOpen(false);
    trigger.current?.focus();
  }
  const searchField = (mobile = false) => <label className="artist-catalogue-search"><span>Search artists</span><input type="search" placeholder={mobile ? "Artist name" : undefined} value={search} onChange={(event) => onSearch(event.target.value)} /></label>;
  const sortField = <label>Sort by<select value={sort} onChange={(event) => onSort(event.target.value as ArtistListSort)}>{artistSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const directionField = <div className="artist-direction" role="group" aria-label="Sort direction"><span>Direction</span><div>{(["asc", "desc"] as const).map((value) => {
    const label = value === "asc" ? "Ascending" : "Descending";
    return <button key={value} type="button" className={direction === value ? "active" : ""} aria-label={label} title={label} aria-pressed={direction === value} onClick={() => onDirection(value)}><span className="artist-direction-label">{label}</span><svg className="artist-direction-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 16 16"><path d={value === "asc" ? "M8 13V3m-4 4 4-4 4 4" : "M8 3v10m-4-4 4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>;
  })}</div></div>;
  const scopes = <div className="artist-scope-filters" role="group" aria-label="Artist catalogue scope">{(["primary", "all", "featuring"] as const).map((value) => <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => onFilter(value)}>{scopeLabels[value]}</button>)}</div>;

  return <>
    <div className="artist-desktop-controls"><div className="artist-catalogue-controls">{searchField()}{sortField}{directionField}</div>{scopes}</div>
    <div className="artist-mobile-controls">
      <div className="artist-mobile-toolbar">{searchField(true)}<button ref={trigger} className="artist-filter-toggle" type="button" aria-expanded={open} aria-controls="artist-mobile-filters" onClick={() => setOpen((value) => !value)}>Filters <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d={open ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button></div>
      {!open && <p className="artist-filter-summary">{artistCatalogueSummary(sort, direction, filter, search)}</p>}
      <section id="artist-mobile-filters" className="artist-filter-panel" aria-label="Artist filters" hidden={!open} onKeyDown={onPanelKeyDown}>
        <div className="artist-panel-sort">{sortField}{directionField}</div>
        {scopes}
      </section>
    </div>
  </>;
}
