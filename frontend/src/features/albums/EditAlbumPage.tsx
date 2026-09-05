import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { getAlbum, updateAlbum, updateTrackArtists } from "../../api/albums";
import { listArtists } from "../../api/artists";
import type { Album, AlbumUpdate, Artist, ReleaseType } from "../../api/types";
import { AlbumCover } from "./AlbumCover";
import { CoverControls } from "./CoverControls";

const releaseTypes: ReleaseType[] = ["album", "ep", "mixtape", "compilation"];
type Credits = Record<number, { primary: number[]; featured: number[] }>;

export function EditAlbumPage({ albumId, onCancel, onSaved }: { albumId: number; onCancel: () => void; onSaved: () => void }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [catalogueArtists, setCatalogueArtists] = useState<Artist[]>([]);
  const [title, setTitle] = useState(""); const [artists, setArtists] = useState<string[]>([]);
  const [year, setYear] = useState(""); const [releaseType, setReleaseType] = useState<ReleaseType>("album");
  const [credits, setCredits] = useState<Credits>({}); const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAlbum(albumId), listArtists()]).then(([loaded, artistList]) => {
      setAlbum(loaded); setCatalogueArtists(artistList); setTitle(loaded.title);
      setArtists(loaded.artists.map((artist) => artist.name)); setYear(loaded.year?.toString() ?? ""); setReleaseType(loaded.release_type);
      setCredits(Object.fromEntries(loaded.tracks.map((track) => [track.id, {
        primary: track.uses_album_artists ? [] : track.primary_artists.map((artist) => artist.id),
        featured: track.featured_artists.map((artist) => artist.id),
      }])));
    }).catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }, [albumId]);

  const selected = (event: ChangeEvent<HTMLSelectElement>) => Array.from(event.target.selectedOptions, (option) => Number(option.value));
  const setTrackCredit = (trackId: number, kind: "primary" | "featured", ids: number[]) => setCredits((current) => ({ ...current, [trackId]: { ...current[trackId], [kind]: ids } }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const parsedYear = year ? Number(year) : null; const cleanArtists = artists.map((artist) => artist.trim()).filter(Boolean);
    if (!title.trim() || !cleanArtists.length) { setError("Title and at least one artist are required."); return; }
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1000 || parsedYear > 3000)) { setError("Enter a valid year."); return; }
    const payload: AlbumUpdate = { title: title.trim(), artists: cleanArtists.map((name) => ({ name })), year: parsedYear, release_type: releaseType };
    setSaving(true);
    try {
      await updateAlbum(albumId, payload);
      await Promise.all(Object.entries(credits).map(([trackId, value]) => updateTrackArtists(Number(trackId), { primary_artist_ids: value.primary, featured_artist_ids: value.featured })));
      onSaved();
    } catch (cause) { setError((cause as Error).message); } finally { setSaving(false); }
  }
  if (loading) return <main className="page"><p>Loading album…</p></main>;
  if (!album) return <main className="page"><button className="back" onClick={onCancel}>← Album</button><p className="notice error">{error || "Album not found."}</p></main>;
  return <main className="page narrow edit-album-page"><button className="back" onClick={onCancel}>← Album</button><p className="eyebrow">Album metadata</p><h1>Edit album</h1><form onSubmit={submit} noValidate>
    <div className="edit-album-cover"><AlbumCover album={album} className="edit-cover" /><div><h2>Cover art</h2><CoverControls album={album} onUpdated={setAlbum} /></div></div>
    <div className="metadata"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div><p className="eyebrow">Artists</p>{artists.map((artist, index) => <div className="artist-input" key={index}><input value={artist} onChange={(event) => setArtists((current) => current.map((value, i) => i === index ? event.target.value : value))} />{artists.length > 1 && <button type="button" className="icon-button" onClick={() => setArtists((current) => current.filter((_, i) => i !== index))}>×</button>}</div>)}<button type="button" className="text-button" onClick={() => setArtists((current) => [...current, ""])}>+ Add artist</button></div><label>Year<input type="number" min="1000" max="3000" value={year} onChange={(event) => setYear(event.target.value)} /></label><label>Release type<select value={releaseType} onChange={(event) => setReleaseType(event.target.value as ReleaseType)}>{releaseTypes.map((type) => <option key={type}>{type}</option>)}</select></label></div>
    <section className="form-section"><h2>Track credits</h2><p>Leave primary artists empty to inherit the album artists. Select multiple artists with Ctrl or Cmd.</p>{album.tracks.map((track) => <div className="track-credit-editor" key={track.id}><strong>{String(track.position).padStart(2, "0")} · {track.title}</strong><label>Primary artists<select multiple value={(credits[track.id]?.primary ?? []).map(String)} onChange={(event) => setTrackCredit(track.id, "primary", selected(event))}>{catalogueArtists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label><label>Featured artists<select multiple value={(credits[track.id]?.featured ?? []).map(String)} onChange={(event) => setTrackCredit(track.id, "featured", selected(event))}>{catalogueArtists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label></div>)}</section>
    {error && <p className="notice error" role="alert">{error}</p>}<div className="edit-album-actions"><button type="button" className="text-button" onClick={onCancel}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
  </form></main>;
}
