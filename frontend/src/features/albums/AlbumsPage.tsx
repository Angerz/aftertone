import { useEffect, useState } from "react";
import { listAlbums } from "../../api/albums";
import type { Album } from "../../api/types";

export function AlbumsPage({ onCreate, onOpen }: { onCreate: () => void; onOpen: (id: number) => void }) {
  const [albums, setAlbums] = useState<Album[]>([]); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { listAlbums().then(setAlbums).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <main className="page">
    <header className="masthead"><div><p className="eyebrow">Aftertone</p><h1>Your listening journal.</h1></div><button onClick={onCreate}>+ Add album</button></header>
    {loading && <p>Loading albums…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!loading && !error && (albums.length ? <ol className="album-list">{albums.map((album) => <li key={album.id}><button className="album-link" onClick={() => onOpen(album.id)}><strong>{album.title}</strong><span>{album.artist} · {album.year ?? "Year unknown"} · {album.release_type}</span></button></li>)}</ol> : <section className="empty"><h2>No albums yet</h2><p>Add one to begin documenting a listening session.</p><button onClick={onCreate}>Add your first album</button></section>)}
  </main>;
}
