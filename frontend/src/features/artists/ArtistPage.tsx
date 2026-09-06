import { useEffect, useState } from "react";
import { getArtist, listArtists } from "../../api/artists";
import type { Artist, ArtistDetail, PaginatedResponse } from "../../api/types";
import { formatArtistNames } from "./artistDisplay";

function ArtistPagination({ result, onPage }: { result: PaginatedResponse<Artist>; onPage: (page: number) => void }) {
  if (result.total_pages <= 1) return null;
  return <nav className="pagination" aria-label="Artist pagination"><button disabled={result.page === 1} onClick={() => onPage(result.page - 1)}>Previous</button><span>Page {result.page} of {result.total_pages}</span><button disabled={result.page === result.total_pages} onClick={() => onPage(result.page + 1)}>Next</button></nav>;
}

export function ArtistsPage({ onBack, onOpen }: { onBack: () => void; onOpen: (id: number) => void }) {
  const [result, setResult] = useState<PaginatedResponse<Artist> | null>(null); const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; listArtists({ page, search }).then((value) => { if (active) setResult(value); }).catch((cause: Error) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [page, search]);
  return <main className="page narrow"><button className="back" onClick={onBack}>← Library</button><p className="eyebrow">Catalogue</p><h1>Artists</h1><label>Search artists<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>{error && <p className="notice error">{error}</p>}<ol className="album-list">{result?.items.map((artist) => <li key={artist.id}><button className="album-link" onClick={() => onOpen(artist.id)}><strong>{artist.name}</strong><span>{artist.album_count ?? 0} album{artist.album_count === 1 ? "" : "s"}</span></button></li>)}</ol>{result && <ArtistPagination result={result} onPage={setPage} />}</main>;
}

export function ArtistPage({ artistId, onBack, onAlbum }: { artistId: number; onBack: () => void; onAlbum: (id: number) => void }) {
  const [artist, setArtist] = useState<ArtistDetail | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { getArtist(artistId).then(setArtist).catch((cause: Error) => setError(cause.message)); }, [artistId]);
  if (!artist) return <main className="page narrow"><button className="back" onClick={onBack}>← Artists</button><p>{error || "Loading artist…"}</p></main>;
  return <main className="page narrow"><button className="back" onClick={onBack}>← Artists</button><p className="eyebrow">Artist</p><h1>{artist.name}</h1><section><h2>Albums</h2><ol className="album-list">{artist.albums.map((album) => <li key={album.id}><button className="album-link" onClick={() => onAlbum(album.id)}><strong>{album.title}</strong><span>{formatArtistNames(album.artists)} · {album.year ?? "Year unknown"}</span></button></li>)}</ol></section>{artist.featured_appearances.length > 0 && <section className="form-section"><h2>Featured appearances</h2><ol className="album-list">{artist.featured_appearances.map((appearance) => <li key={appearance.track_id}><button className="album-link" onClick={() => onAlbum(appearance.album_id)}><strong>{appearance.track_title}</strong><span>{appearance.album_title}</span></button></li>)}</ol></section>}</main>;
}
