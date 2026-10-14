import { initialAftertoneState, nextAftertoneState } from "../../navigation";
import { OwnerOnly, useOwner } from "../auth/Auth";
import { useEffect, useState } from "react";
import { getAlbumFacets, getAlbumRatingSummary, listAlbums } from "../../api/albums";
import type { Album, AlbumFacets, AlbumRatingSummary, PaginatedResponse } from "../../api/types";
import { AlbumCard } from "./AlbumCard";
import { defaultLibrarySortDirection, type LibrarySort, type LibrarySortDirection } from "./library";
import { buildAlbumQueryParams, parseLibraryNavigation, type LibraryNavigation } from "./pagination";
import { formatLibraryAverage, ratedProjectLabel, shouldShowLibraryRatingSummary } from "./libraryRatingSummary";
import { getRatingTier } from "./ratingTier";

const libraryPageSize = 25;

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 2);
  return <nav className="pagination" aria-label="Pagination"><button onClick={() => onPage(page - 1)} disabled={page === 1}>Previous</button>{pages.map((item, index) => <span key={item}>{index > 0 && item - pages[index - 1] > 1 && "…"}<button className={item === page ? "active" : ""} onClick={() => onPage(item)} aria-current={item === page ? "page" : undefined}>{item}</button></span>)}<button onClick={() => onPage(page + 1)} disabled={page === totalPages}>Next</button></nav>;
}

function LibraryRatingSummaryBlock({ summary, loading }: { summary: AlbumRatingSummary | null; loading: boolean }) {
  const tier = getRatingTier(summary?.average);
  return <aside className={`library-rating-summary ${tier ? `rating-${tier}` : "unrated"}`} aria-live="polite"><span>Average rating</span><strong>{loading ? "…" : formatLibraryAverage(summary?.average ?? null)}</strong><small>{loading ? "Loading…" : ratedProjectLabel(summary?.rated_count ?? 0)}</small></aside>;
}

export function AlbumsPage({ onCreate, onOpen }: { onCreate: () => void; onOpen: (id: number) => void }) {
  const owner = useOwner();
  const readNavigation = () => { const parsed = parseLibraryNavigation(); return { ...parsed, revisit: owner && parsed.revisit }; };
  const [navigation, setNavigation] = useState<LibraryNavigation>(readNavigation);
  const [result, setResult] = useState<PaginatedResponse<Album> | null>(null); const [facets, setFacets] = useState<AlbumFacets>({ decades: {} });
  const [summary, setSummary] = useState<AlbumRatingSummary | null>(null); const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { getAlbumFacets().then(setFacets).catch((cause: Error) => setError(cause.message)); }, []);
  useEffect(() => { const onPopState = () => setNavigation(() => { const parsed = parseLibraryNavigation(); return { ...parsed, revisit: owner && parsed.revisit }; }); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, [owner]);
  useEffect(() => { let active = true; setLoading(true); setError(null); listAlbums({ ...navigation, page_size: libraryPageSize }).then((value) => { if (active) setResult(value); }).catch((cause: Error) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); }); const params = buildAlbumQueryParams(navigation); window.history.replaceState(initialAftertoneState(window.history.state), "", `${window.location.pathname}${params.size ? `?${params}` : ""}`); return () => { active = false; }; }, [navigation]);
  const showSummary = shouldShowLibraryRatingSummary(navigation.search, navigation.unrated);
  useEffect(() => { if (!showSummary) { setSummary(null); setSummaryLoading(false); return; } let active = true; setSummary(null); setSummaryLoading(true); getAlbumRatingSummary({ decade: navigation.decade, year: navigation.year, month: navigation.month, revisit: navigation.revisit, unrated: navigation.unrated }).then((value) => { if (active) setSummary(value); }).catch((cause: Error) => { if (active) setError(cause.message); }).finally(() => { if (active) setSummaryLoading(false); }); return () => { active = false; }; }, [navigation.decade, navigation.year, navigation.month, navigation.revisit, navigation.unrated, showSummary]);
  const change = (next: Partial<LibraryNavigation>, resetPage = true) => setNavigation((current) => ({ ...current, ...next, page: resetPage ? 1 : next.page ?? current.page }));
  const pushSortingNavigation = (next: LibraryNavigation) => { const params = buildAlbumQueryParams(next); window.history.pushState(nextAftertoneState(window.history.state), "", `${window.location.pathname}${params.size ? `?${params}` : ""}`); setNavigation(next); };
  const chooseSort = (sort: LibrarySort) => pushSortingNavigation({ ...navigation, sort, direction: defaultLibrarySortDirection(sort), page: 1 });
  const chooseDirection = (direction: LibrarySortDirection) => pushSortingNavigation({ ...navigation, direction, page: 1 });
  const decades = Object.keys(facets.decades).map(Number).sort((left, right) => left - right);
  const years = navigation.decade ? facets.decades[String(navigation.decade)] ?? [] : [];
  return <main className="page">
    <header className="masthead library-header"><div><h1>Library</h1><p>Your collection of listened-to records.</p></div><OwnerOnly><div className="library-actions"><button onClick={onCreate}>+ Add album</button></div></OwnerOnly></header>
    <div className="library-controls"><label className="library-search">Search your library<input type="search" value={navigation.search ?? ""} onChange={(event) => change({ search: event.target.value || undefined })} placeholder="Title or artist" /></label><label>Sort by<select value={navigation.sort} onChange={(event) => chooseSort(event.target.value as LibrarySort)}><option value="rating">Rating</option><option value="recent">Date rated</option><option value="year">Release year</option><option value="artist">Artist</option><option value="title">Title</option></select></label><div className="library-direction" role="group" aria-label="Sort direction"><span>Direction</span><div><button className={navigation.direction === "asc" ? "active" : ""} aria-pressed={navigation.direction === "asc"} onClick={() => chooseDirection("asc")}>Ascending</button><button className={navigation.direction === "desc" ? "active" : ""} aria-pressed={navigation.direction === "desc"} onClick={() => chooseDirection("desc")}>Descending</button></div></div></div>
    <section className="status-filter" aria-label="Album status filter"><p className="eyebrow">Status</p><div className="status-filter-row"><OwnerOnly><button className={navigation.revisit ? "active status-revisit" : ""} aria-pressed={navigation.revisit} onClick={() => change({ revisit: !navigation.revisit })}>Revisit</button></OwnerOnly><button className={navigation.unrated ? "active" : ""} aria-pressed={navigation.unrated} onClick={() => change({ unrated: !navigation.unrated })}>Not rated</button></div></section>
    <section className="time-filter" aria-label="Release date filter"><div className="time-filter-main"><div><div className="time-filter-row"><button className={!navigation.decade ? "active" : ""} onClick={() => change({ decade: undefined, year: undefined, month: undefined })}>All years</button>{decades.map((decade) => <button key={decade} className={navigation.decade === decade ? "active" : ""} onClick={() => change({ decade, year: undefined, month: undefined })}>{decade}s</button>)}</div>{navigation.decade && <div className="time-filter-row years"><button className={!navigation.year ? "active" : ""} onClick={() => change({ year: undefined, month: undefined })}>All {navigation.decade}s</button>{years.map((year) => <button key={year} className={navigation.year === year ? "active" : ""} onClick={() => change({ year, month: undefined })}>{year}</button>)}</div>}{navigation.month && navigation.year && <p className="library-month-filter">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(navigation.year, navigation.month - 1, 1))}<button className="text-button" onClick={() => change({ month: undefined })}>Clear month</button></p>}</div>{showSummary && <LibraryRatingSummaryBlock summary={summary} loading={summaryLoading} />}</div></section>
    {loading && <p>Loading albums…</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && result && (result.items.length ? <><ol className="album-grid">{result.items.map((album) => <AlbumCard key={album.id} album={album} onOpen={onOpen} />)}</ol><Pagination page={result.page} totalPages={result.total_pages} onPage={(page) => { change({ page }, false); window.scrollTo({ top: 0 }); }} /></> : <section className="empty"><h2>{result.total ? "No albums on this page." : "No albums match this search."}</h2><p>Try a different title, artist, or period.</p><button onClick={() => change({ search: undefined, decade: undefined, year: undefined, month: undefined, revisit: false, unrated: false })}>Clear filters</button></section>)}
  </main>;
}
