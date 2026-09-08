import { useEffect, useState } from "react";
import { getArtist, listArtists } from "../../api/artists";
import type { Artist, ArtistAlbum, ArtistDetail, PaginatedResponse } from "../../api/types";
import { AlbumCover } from "../albums/AlbumCover";
import { formatLibraryRating } from "../albums/library";
import { getRatingTier } from "../albums/ratingTier";
import { formatArtistNames } from "./artistDisplay";
import { groupArtistProjects, summarizeArtistProjects } from "./artistProjects";

function ArtistPagination({ result, onPage }: { result: PaginatedResponse<Artist>; onPage: (page: number) => void }) {
  if (result.total_pages <= 1) return null;
  return <nav className="pagination" aria-label="Artist pagination"><button disabled={result.page === 1} onClick={() => onPage(result.page - 1)}>Previous</button><span>Page {result.page} of {result.total_pages}</span><button disabled={result.page === result.total_pages} onClick={() => onPage(result.page + 1)}>Next</button></nav>;
}

export function ArtistsPage({ onBack, onOpen }: { onBack: () => void; onOpen: (id: number) => void }) {
  const [result, setResult] = useState<PaginatedResponse<Artist> | null>(null); const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; listArtists({ page, search }).then((value) => { if (active) setResult(value); }).catch((cause: Error) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [page, search]);
  return <main className="page narrow"><button className="back" onClick={onBack}>← Library</button><p className="eyebrow">Catalogue</p><h1>Artists</h1><label>Search artists<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>{error && <p className="notice error">{error}</p>}<ol className="album-list">{result?.items.map((artist) => <li key={artist.id}><button className="album-link" onClick={() => onOpen(artist.id)}><strong>{artist.name}</strong><span>{artist.album_count ?? 0} album{artist.album_count === 1 ? "" : "s"}</span></button></li>)}</ol>{result && <ArtistPagination result={result} onPage={setPage} />}</main>;
}

function ProjectCard({ album, onOpen }: { album: ArtistAlbum; onOpen: (id: number) => void }) {
  const tier = getRatingTier(album.rating);
  return <li><button className="artist-project" onClick={() => onOpen(album.id)}><AlbumCover album={album} className="artist-project-cover" /><span className="artist-project-copy"><strong>{album.title}</strong><span>{formatArtistNames(album.artists)}</span><small>{album.year ?? "Year unknown"} · {album.release_type}</small></span><b className={tier ? `artist-project-rating rating-${tier}` : "artist-project-rating unrated"}>{album.rating === null ? "Unrated" : formatLibraryRating(album.rating)}</b></button></li>;
}

export function ArtistPage({ artistId, onBack, onAlbum }: { artistId: number; onBack: () => void; onAlbum: (id: number) => void }) {
  const [artist, setArtist] = useState<ArtistDetail | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { getArtist(artistId).then(setArtist).catch((cause: Error) => setError(cause.message)); }, [artistId]);
  if (!artist) return <main className="page narrow"><button className="back" onClick={onBack}>← Artists</button><p>{error || "Loading artist…"}</p></main>;
  const { average, ratedProjects } = summarizeArtistProjects(artist); const averageTier = getRatingTier(average); const groups = groupArtistProjects(artist.albums);
  return <main className="page artist-page"><button className="back" onClick={onBack}>← Artists</button><header className="artist-page-header"><div><p className="eyebrow">Artist</p><h1>{artist.name}</h1><p>{artist.album_count ?? artist.albums.length} primary project{(artist.album_count ?? artist.albums.length) === 1 ? "" : "s"} · {ratedProjects} rated</p></div><aside className={`artist-average ${averageTier ? `rating-${averageTier}` : "unrated"}`} aria-label={average === null ? "No rated primary projects" : `Average rating ${formatLibraryRating(average)}`}><strong>{average === null ? "Not rated" : formatLibraryRating(average)}</strong><span>Average rating</span></aside></header><section className="artist-projects"><h2>Projects</h2>{groups.map((group) => <section className="artist-project-group" key={group.releaseType}><h3>{group.label}</h3><ol>{group.projects.map((album) => <ProjectCard key={album.id} album={album} onOpen={onAlbum} />)}</ol></section>)}</section>{artist.featured_appearances.length > 0 && <section className="featured-appearances"><h2>Featured appearances</h2><ol className="album-list">{artist.featured_appearances.map((appearance) => <li key={appearance.track_id}><button className="album-link" onClick={() => onAlbum(appearance.album_id)}><strong>{appearance.track_title}</strong><span>{appearance.album_title}</span></button></li>)}</ol></section>}</main>;
}
