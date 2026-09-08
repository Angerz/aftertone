import { useEffect, useState } from "react";
import { listArtists } from "../../api/artists";
import type { Artist } from "../../api/types";

export const addArtist = (selected: Artist[], artist: Artist) => selected.some((item) => item.id === artist.id) ? selected : [...selected, artist];
export const removeArtist = (selected: Artist[], artistId: number) => selected.filter((artist) => artist.id !== artistId);

export function ArtistSearchPicker({ label, selected, onChange, helper }: { label: string; selected: Artist[]; onChange: (artists: Artist[]) => void; helper?: string }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Artist[]>([]); const [open, setOpen] = useState(false);
  useEffect(() => {
    const term = query.trim(); if (!term) { setResults([]); return; }
    const timer = window.setTimeout(() => { listArtists({ search: term, page: 1, page_size: 12 }).then((response) => setResults(response.items)).catch(() => setResults([])); }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  const choose = (artist: Artist) => { onChange(addArtist(selected, artist)); setQuery(""); setResults([]); setOpen(false); };
  return <div className="artist-search-picker"><label>{label}<input value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { event.preventDefault(); choose(results[0]); } }} placeholder="Search artists..." /></label>{helper && <small>{helper}</small>}{selected.length > 0 && <div className="artist-chips" aria-label={`Selected ${label}`}>{selected.map((artist) => <button type="button" key={artist.id} onClick={() => onChange(removeArtist(selected, artist.id))}>{artist.name} <span aria-hidden="true">×</span><span className="sr-only">Remove {artist.name}</span></button>)}</div>}{open && query.trim() && <ul className="artist-search-results" role="listbox">{results.length ? results.map((artist) => <li key={artist.id}><button type="button" role="option" aria-selected={selected.some((item) => item.id === artist.id)} disabled={selected.some((item) => item.id === artist.id)} onClick={() => choose(artist)}>{artist.name}</button></li>) : <li>No artists found.</li>}</ul>}</div>;
}
