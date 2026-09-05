import { useEffect, useMemo, useState } from "react";
import { listAlbums } from "../../api/albums";
import type { Album } from "../../api/types";
import { AlbumCard } from "./AlbumCard";
import { filterAndSortAlbums, type LibrarySort } from "./library";

export function AlbumsPage({ onCreate, onImport, onArtists, onOpen }: { onCreate: () => void; onImport: () => void; onArtists: () => void; onOpen: (id: number) => void }) {
  const [albums, setAlbums] = useState<Album[]>([]); const [query, setQuery] = useState(""); const [sort, setSort] = useState<LibrarySort>("rating"); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { listAlbums().then(setAlbums).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const visibleAlbums = useMemo(() => filterAndSortAlbums(albums, query, sort), [albums, query, sort]);
  return <main className="page">
    <header className="masthead library-header"><div><p className="eyebrow">Aftertone</p><h1>Library</h1><p>Your collection of listened-to records.</p></div><div className="library-actions"><button className="text-button" onClick={onArtists}>Artists</button><button className="text-button" onClick={onImport}>Import legacy ratings</button><button onClick={onCreate}>+ Add album</button></div></header>
    {loading && <p>Loading albums…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && (albums.length ? <><div className="library-controls"><label>Search your library<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or artist" /></label><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}><option value="rating">Rating — highest first</option><option value="recent">Recently rated</option><option value="year">Year — newest first</option><option value="artist">Artist</option><option value="title">Title</option></select></label></div>{visibleAlbums.length ? <ol className="album-grid">{visibleAlbums.map((album) => <AlbumCard key={album.id} album={album} onOpen={onOpen} />)}</ol> : <section className="empty"><h2>No albums match this search.</h2><p>Try a different title or artist.</p><button onClick={() => setQuery("")}>Clear search</button></section>}</> : <section className="empty"><h2>Your library is empty.</h2><p>Add your first album to start your collection.</p><button onClick={onCreate}>Add your first album</button></section>)}
  </main>;
}
