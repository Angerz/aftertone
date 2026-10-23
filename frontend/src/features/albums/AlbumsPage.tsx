import { initialAftertoneState, nextAftertoneState } from "../../navigation";
import { OwnerOnly, useOwner } from "../auth/Auth";
import { useEffect, useState } from "react";
import { getAlbumFacets, getAlbumRatingSummary, listAlbums } from "../../api/albums";
import type { Album, AlbumFacets, AlbumRatingSummary, PaginatedResponse } from "../../api/types";
import { AlbumCard } from "./AlbumCard";
import { defaultLibrarySortDirection, type LibrarySort, type LibrarySortDirection } from "./library";
import { buildAlbumQueryParams, parseLibraryNavigation, type LibraryNavigation } from "./pagination";
import { shouldShowLibraryRatingSummary } from "./libraryRatingSummary";
import { LibraryControls } from "./LibraryControls";
import "./libraryCardsMobile.css";

const libraryPageSize = 25;

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 2);
  return <nav className="pagination" aria-label="Pagination"><button onClick={() => onPage(page - 1)} disabled={page === 1}>Previous</button>{pages.map((item, index) => <span className="pagination-page" key={item}>{index > 0 && item - pages[index - 1] > 1 && "…"}<button className={item === page ? "active" : ""} onClick={() => onPage(item)} aria-current={item === page ? "page" : undefined}>{item}</button></span>)}<span className="pagination-compact" aria-label={`Page ${page} of ${totalPages}`}>{page} / {totalPages}</span><button onClick={() => onPage(page + 1)} disabled={page === totalPages}>Next</button></nav>;
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
  return <main className="page library-page">
    <header className="masthead library-header"><div className="library-heading"><h1>Library</h1><p>Your collection of listened-to records.</p></div><OwnerOnly><div className="library-actions"><button onClick={onCreate}>+ Add album</button></div></OwnerOnly></header>
    <LibraryControls navigation={navigation} facets={facets} summary={summary} summaryLoading={summaryLoading} onChange={change} onSort={chooseSort} onDirection={chooseDirection} />
    {loading && <p>Loading albums…</p>}{error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && result && (result.items.length ? <><ol className="album-grid">{result.items.map((album) => <AlbumCard key={album.id} album={album} onOpen={onOpen} />)}</ol><Pagination page={result.page} totalPages={result.total_pages} onPage={(page) => { change({ page }, false); window.scrollTo({ top: 0 }); }} /></> : <section className="empty"><h2>{result.total ? "No albums on this page." : "No albums match this search."}</h2><p>Try a different title, artist, or period.</p><button onClick={() => change({ search: undefined, decade: undefined, year: undefined, month: undefined, revisit: false, unrated: false })}>Clear filters</button></section>)}
  </main>;
}
