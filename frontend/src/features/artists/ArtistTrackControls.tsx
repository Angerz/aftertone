import { useRef, useState, type KeyboardEvent } from "react";
import type { ArtistSortDirection, ArtistTrackSort } from "../../api/artists";
import "./artistDetailMobile.css";

const sortLabels: Record<ArtistTrackSort, string> = { rating: "Track rating", release_date: "Release date", album: "Album", title: "Title" };

export function ArtistTrackControls({ search, sort, direction, onSearch, onSort, onDirection }: {
  search: string;
  sort: ArtistTrackSort;
  direction: ArtistSortDirection;
  onSearch: (value: string) => void;
  onSort: (value: ArtistTrackSort) => void;
  onDirection: (value: ArtistSortDirection) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    setOpen(false);
    trigger.current?.focus();
  }
  const searchField = <label><span>Search tracks</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Track title or album" /></label>;
  const sortField = <label>Sort by<select value={sort} onChange={(event) => onSort(event.target.value as ArtistTrackSort)}>{(Object.entries(sortLabels) as [ArtistTrackSort, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
  const directionField = <div className="artist-direction" role="group" aria-label="Sort direction"><span>Direction</span><div>{(["asc", "desc"] as const).map((value) => {
    const label = value === "asc" ? "Ascending" : "Descending";
    return <button key={value} type="button" className={direction === value ? "active" : ""} aria-label={label} title={label} aria-pressed={direction === value} onClick={() => onDirection(value)}><span className="artist-track-direction-label">{label}</span><svg className="artist-track-direction-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 16 16"><path d={value === "asc" ? "M8 13V3m-4 4 4-4 4 4" : "M8 3v10m-4-4 4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>;
  })}</div></div>;
  return <>
    <div className="artist-track-desktop-controls"><div className="artist-track-controls">{searchField}{sortField}{directionField}</div></div>
    <div className="artist-track-mobile-controls">
      <div className="artist-track-mobile-toolbar">{searchField}<button ref={trigger} type="button" className="artist-track-filter-toggle" aria-expanded={open} aria-controls="artist-track-mobile-sort" onClick={() => setOpen((value) => !value)}>Sort <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d={open ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button></div>
      {!open && <p className="artist-track-sort-summary">{sortLabels[sort]}, {direction === "asc" ? "ascending" : "descending"}</p>}
      <section id="artist-track-mobile-sort" className="artist-track-sort-panel" aria-label="Track sorting" hidden={!open} onKeyDown={onPanelKeyDown}><div className="artist-track-panel-sort">{sortField}{directionField}</div></section>
    </div>
  </>;
}
