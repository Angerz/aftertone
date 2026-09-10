import { useEffect, useState } from "react";
import { createArtist, listArtists } from "../../api/artists";
import type { Artist } from "../../api/types";
import { pickerArtistParams } from "./artistMaintenance";

export const addArtist = (selected: Artist[], artist: Artist) => selected.some((item) => item.id === artist.id) ? selected : [...selected, artist];
export const removeArtist = (selected: Artist[], artistId: number) => selected.filter((artist) => artist.id !== artistId);
export const normalizeArtistSearch = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export const canCreateArtist = (query: string, results: Artist[]) => Boolean(normalizeArtistSearch(query)) && !results.some((artist) => (artist.normalized_name ?? normalizeArtistSearch(artist.name)) === normalizeArtistSearch(query));

export function ArtistSearchPicker({ label, selected, onChange, helper }: { label: string; selected: Artist[]; onChange: (artists: Artist[]) => void; helper?: string }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Artist[]>([]); const [open, setOpen] = useState(false); const [creating, setCreating] = useState(false); const [createError, setCreateError] = useState<string | null>(null);
  useEffect(() => {
    const term = query.trim(); if (!term) { setResults([]); return; }
    const timer = window.setTimeout(() => { listArtists(pickerArtistParams(term)).then((response) => setResults(response.items)).catch(() => setResults([])); }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  const choose = (artist: Artist) => { onChange(addArtist(selected, artist)); setQuery(""); setResults([]); setOpen(false); };
  const create = async () => { const name = query.trim(); if (!name || creating) return; setCreating(true); setCreateError(null); try { choose(await createArtist(name)); } catch (cause) { setCreateError((cause as Error).message); } finally { setCreating(false); } };
  const showCreate = canCreateArtist(query, results);
  return <div className="artist-search-picker"><label>{label}<input value={query} onChange={(event) => { setQuery(event.target.value); setCreateError(null); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { event.preventDefault(); choose(results[0]); } }} placeholder="Search artists..." /></label>{helper && <small>{helper}</small>}{selected.length > 0 && <div className="artist-chips" aria-label={`Selected ${label}`}>{selected.map((artist) => <button type="button" key={artist.id} onClick={() => onChange(removeArtist(selected, artist.id))}>{artist.name} <span aria-hidden="true">×</span><span className="sr-only">Remove {artist.name}</span></button>)}</div>}{open && query.trim() && <ul className="artist-search-results" role="listbox">{results.map((artist) => <li key={artist.id}><button type="button" role="option" aria-selected={selected.some((item) => item.id === artist.id)} disabled={selected.some((item) => item.id === artist.id)} onClick={() => choose(artist)}>{artist.name}</button></li>)}{showCreate && <li className="artist-create-option" style={{ borderTop: "1px solid #d8d0c5", marginTop: ".25rem", paddingTop: ".25rem" }}><button type="button" disabled={creating} onClick={create} style={{ color: "#8c421b" }}><strong>{creating ? "Creating…" : `+ Create artist “${query.trim()}”`}</strong></button></li>}{!results.length && !showCreate && <li>No artists found.</li>}</ul>}{createError && <small className="artist-picker-error" role="alert" style={{ color: "#ac3b24" }}>{createError}</small>}</div>;
}
