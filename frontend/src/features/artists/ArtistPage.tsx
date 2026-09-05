import { useEffect, useState } from "react";
import { getArtist, listArtists } from "../../api/artists";
import type { Artist, ArtistDetail } from "../../api/types";
import { formatArtistNames } from "./artistDisplay";

export function ArtistsPage({ onBack, onOpen }: { onBack: () => void; onOpen: (id: number) => void }) {
  const [artists, setArtists] = useState<Artist[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { listArtists().then(setArtists).catch((cause: Error) => setError(cause.message)); }, []);
  return <main className="page narrow"><button className="back" onClick={onBack}>← Library</button><p className="eyebrow">Catalogue</p><h1>Artists</h1>{error && <p className="notice error">{error}</p>}<ol className="album-list">{artists.map((artist) => <li key={artist.id}><button className="album-link" onClick={() => onOpen(artist.id)}><strong>{artist.name}</strong><span>{artist.album_count ?? 0} album{artist.album_count === 1 ? "" : "s"}</span></button></li>)}</ol></main>;
}

export function ArtistPage({ artistId, onBack, onAlbum }: { artistId: number; onBack: () => void; onAlbum: (id: number) => void }) {
  const [artist, setArtist] = useState<ArtistDetail | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { getArtist(artistId).then(setArtist).catch((cause: Error) => setError(cause.message)); }, [artistId]);
  if (!artist) return <main className="page narrow"><button className="back" onClick={onBack}>← Artists</button><p>{error || "Loading artist…"}</p></main>;
  return <main className="page narrow"><button className="back" onClick={onBack}>← Artists</button><p className="eyebrow">Artist</p><h1>{artist.name}</h1><section><h2>Albums</h2><ol className="album-list">{artist.albums.map((album) => <li key={album.id}><button className="album-link" onClick={() => onAlbum(album.id)}><strong>{album.title}</strong><span>{formatArtistNames(album.artists)} · {album.year ?? "Year unknown"}</span></button></li>)}</ol></section>{artist.featured_appearances.length > 0 && <section className="form-section"><h2>Featured appearances</h2><ol className="album-list">{artist.featured_appearances.map((appearance) => <li key={appearance.track_id}><button className="album-link" onClick={() => onAlbum(appearance.album_id)}><strong>{appearance.track_title}</strong><span>{appearance.album_title}</span></button></li>)}</ol></section>}</main>;
}
