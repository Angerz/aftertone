import { useEffect, useState } from "react";
import { getAlbumFacets, listAlbums } from "../../api/albums";
import type { Album, AlbumFacets, PaginatedResponse } from "../../api/types";
import { AlbumCard } from "./AlbumCard";
import type { LibrarySort } from "./library";
import { buildAlbumQueryParams, parseLibraryNavigation, type LibraryNavigation } from "./pagination";

const libraryPageSize = 25;

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 2);
  return <nav className="pagination" aria-label="Pagination"><button onClick={() => onPage(page - 1)} disabled={page === 1}>Previous</button>{pages.map((item, index) => <span key={item}>{index > 0 && item - pages[index - 1] > 1 && "…"}<button className={item === page ? "active" : ""} onClick={() => onPage(item)} aria-current={item === page ? "page" : undefined}>{item}</button></span>)}<button onClick={() => onPage(page + 1)} disabled={page === totalPages}>Next</button></nav>;
}

export function AlbumsPage({ onCreate, onImport, onArtists, onOpen }: { onCreate: () => void; onImport: () => void; onArtists: () => void; onOpen: (id: number) => void }) {
  const [navigation, setNavigation] = useState<LibraryNavigation>(() => parseLibraryNavigation());
  const [result, setResult] = useState<PaginatedResponse<Album> | null>(null); const [facets, setFacets] = useState<AlbumFacets>({ decades: {} });
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { getAlbumFacets().then(setFacets).catch((cause: Error) => setError(cause.message)); }, []);
  useEffect(() => { const onPopState = () => setNavigation(parseLibraryNavigation()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  useEffect(() => { let active = true; setLoading(true); setError(null); listAlbums({ ...navigation, page_size: libraryPageSize }).then((value) => { if (active) setResult(value); }).catch((cause: Error) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); }); const params = buildAlbumQueryParams(navigation); window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`); return () => { active = false; }; }, [navigation]);
  const change = (next: Partial<LibraryNavigation>, resetPage = true) => setNavigation((current) => ({ ...current, ...next, page: resetPage ? 1 : next.page ?? current.page }));
  const decades = Object.keys(facets.decades).map(Number).sort((left, right) => left - right);
  const years = navigation.decade ? facets.decades[String(navigation.decade)] ?? [] : [];
  return <main className="page">
    <header className="masthead library-header"><div><p className="eyebrow">Aftertone</p><h1>Library</h1><p>Your collection of listened-to records.</p></div><div className="library-actions"><button className="text-button" onClick={onArtists}>Artists</button><button className="text-button" onClick={onImport}>Import legacy ratings</button><button onClick={onCreate}>+ Add album</button></div></header>
    <div className="library-controls"><label>Search your library<input type="search" value={navigation.search ?? ""} onChange={(event) => change({ search: event.target.value || undefined })} placeholder="Title or artist" /></label><label>Sort by<select value={navigation.sort} onChange={(event) => change({ sort: event.target.value as LibrarySort })}><option value="rating">Rating — highest first</option><option value="recent">Recently rated</option><option value="year">Year — newest first</option><option value="artist">Artist</option><option value="title">Title</option></select></label></div>
    <section className="time-filter" aria-label="Release date filter"><div className="time-filter-row"><button className={!navigation.decade ? "active" : ""} onClick={() => change({ decade: undefined, year: undefined })}>All years</button>{decades.map((decade) => <button key={decade} className={navigation.decade === decade ? "active" : ""} onClick={() => change({ decade, year: undefined })}>{decade}s</button>)}</div>{navigation.decade && <div className="time-filter-row years"><button className={!navigation.year ? "active" : ""} onClick={() => change({ year: undefined })}>All {navigation.decade}s</button>{years.map((year) => <button key={year} className={navigation.year === year ? "active" : ""} onClick={() => change({ year })}>{year}</button>)}</div>}</section>
    {loading && <p>Loading albums…</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && result && (result.items.length ? <><ol className="album-grid">{result.items.map((album) => <AlbumCard key={album.id} album={album} onOpen={onOpen} />)}</ol><Pagination page={result.page} totalPages={result.total_pages} onPage={(page) => { change({ page }, false); window.scrollTo({ top: 0 }); }} /></> : <section className="empty"><h2>{result.total ? "No albums on this page." : "No albums match this search."}</h2><p>Try a different title, artist, or period.</p><button onClick={() => change({ search: undefined, decade: undefined, year: undefined })}>Clear filters</button></section>)}
  </main>;
}
