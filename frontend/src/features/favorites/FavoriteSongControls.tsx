import { useRef, useState, type KeyboardEvent } from "react";
import type { FavoriteSongSort } from "./favoriteSongSorting";
import "./favoriteSongsMobile.css";

const sortOptions: { value: FavoriteSongSort; label: string }[] = [
  { value: "position", label: "Position" },
  { value: "emotional_connection", label: "Emotional connection" },
  { value: "replay_value", label: "Replay value" },
  { value: "base_score", label: "Song score" },
  { value: "originality", label: "Originality" },
  { value: "title", label: "Title" },
];

export function FavoriteSongControls({ search, sort, onSearch, onSort }: {
  search: string;
  sort: FavoriteSongSort;
  onSearch: (value: string) => void;
  onSort: (value: FavoriteSongSort) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    setOpen(false);
    trigger.current?.focus();
  }
  const searchField = <label className="favorite-song-search"><span>Search songs</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search songs..." /></label>;
  const sortField = <label className="favorite-sort">Sort by<select value={sort} onChange={(event) => onSort(event.target.value as FavoriteSongSort)}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  return <>
    <div className="favorite-desktop-controls"><div className="favorite-actions">{searchField}{sortField}</div></div>
    <div className="favorite-mobile-controls">
      <div className="favorite-mobile-toolbar">{searchField}<button ref={trigger} type="button" className="favorite-sort-toggle" aria-expanded={open} aria-controls="favorite-mobile-sort" onClick={() => setOpen((value) => !value)}>Sort <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d={open ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button></div>
      {!open && <p className="favorite-sort-summary">Sort: {sortOptions.find((option) => option.value === sort)?.label}</p>}
      <section id="favorite-mobile-sort" className="favorite-sort-panel" aria-label="Song sorting" hidden={!open} onKeyDown={onPanelKeyDown}>{sortField}</section>
    </div>
  </>;
}
