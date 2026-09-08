import { type FormEvent, useEffect, useState } from "react";
import { getAlbum, updateAlbum, updateTrackArtists } from "../../api/albums";
import type { Album, AlbumUpdate, Artist, ReleaseType, TrackUpdate } from "../../api/types";
import { AlbumCover } from "./AlbumCover";
import { CoverControls } from "./CoverControls";
import { parseTracklistText } from "./tracklistEditor";
import { ArtistSearchPicker } from "../artists/ArtistSearchPicker";

const releaseTypes: ReleaseType[] = ["album", "ep", "mixtape", "compilation", "live", "reissue"];
type Credits = Record<number, { primary: Artist[]; featured: Artist[] }>;

export function EditAlbumPage({ albumId, onCancel, onSaved }: { albumId: number; onCancel: () => void; onSaved: () => void }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [title, setTitle] = useState(""); const [artists, setArtists] = useState<string[]>([]);
  const [year, setYear] = useState(""); const [releaseType, setReleaseType] = useState<ReleaseType>("album");
  const [tracks, setTracks] = useState<TrackUpdate[]>([]); const [tracklistText, setTracklistText] = useState("");
  const [credits, setCredits] = useState<Credits>({}); const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAlbum(albumId).then((loaded) => {
      setAlbum(loaded); setTitle(loaded.title);
      setArtists(loaded.artists.map((artist) => artist.name)); setYear(loaded.year?.toString() ?? ""); setReleaseType(loaded.release_type);
      setTracks(loaded.tracks.map((track) => ({ id: track.id, title: track.title })));
      setCredits(Object.fromEntries(loaded.tracks.map((track) => [track.id, {
        primary: track.uses_album_artists ? [] : track.primary_artists,
        featured: track.featured_artists,
      }])));
    }).catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }, [albumId]);

  const setTrackCredit = (trackId: number, kind: "primary" | "featured", artists: Artist[]) => setCredits((current) => ({ ...current, [trackId]: { ...current[trackId], [kind]: artists } }));
  const moveTrack = (index: number, direction: -1 | 1) => setTracks((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const addPastedTracks = () => setTracks(parseTracklistText(tracklistText));
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const parsedYear = year ? Number(year) : null; const cleanArtists = artists.map((artist) => artist.trim()).filter(Boolean);
    if (!title.trim() || !cleanArtists.length) { setError("Title and at least one artist are required."); return; }
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1000 || parsedYear > 3000)) { setError("Enter a valid year."); return; }
    if (!tracks.length || tracks.some((track) => !track.title.trim())) { setError("Add at least one track with a title."); return; }
    const payload: AlbumUpdate = { title: title.trim(), artists: cleanArtists.map((name) => ({ name })), year: parsedYear, release_type: releaseType, tracks: tracks.map((track) => ({ ...track, title: track.title.trim() })) };
    setSaving(true);
    try {
      const saved = await updateAlbum(albumId, payload);
      const savedIds = new Set(saved.tracks.map((track) => track.id));
      await Promise.all(Object.entries(credits).filter(([trackId]) => savedIds.has(Number(trackId))).map(([trackId, value]) => updateTrackArtists(Number(trackId), { primary_artist_ids: value.primary.map((artist) => artist.id), featured_artist_ids: value.featured.map((artist) => artist.id) })));
      onSaved();
    } catch (cause) { setError((cause as Error).message); } finally { setSaving(false); }
  }
  if (loading) return <main className="page"><p>Loading album…</p></main>;
  if (!album) return <main className="page"><button className="back" onClick={onCancel}>← Album</button><p className="notice error">{error || "Album not found."}</p></main>;
  return <main className="page narrow edit-album-page"><button className="back" onClick={onCancel}>← Album</button><p className="eyebrow">Album metadata</p><h1>Edit album</h1><form onSubmit={submit} noValidate>
    <div className="edit-album-cover"><AlbumCover album={album} className="edit-cover" /><div><h2>Cover art</h2><CoverControls album={album} onUpdated={setAlbum} /></div></div>
    <div className="metadata"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div><p className="eyebrow">Artists</p>{artists.map((artist, index) => <div className="artist-input" key={index}><input value={artist} onChange={(event) => setArtists((current) => current.map((value, i) => i === index ? event.target.value : value))} />{artists.length > 1 && <button type="button" className="icon-button" onClick={() => setArtists((current) => current.filter((_, i) => i !== index))}>×</button>}</div>)}<button type="button" className="text-button" onClick={() => setArtists((current) => [...current, ""])}>+ Add artist</button></div><label>Year<input type="number" min="1000" max="3000" value={year} onChange={(event) => setYear(event.target.value)} /></label><label>Release type<select value={releaseType} onChange={(event) => setReleaseType(event.target.value as ReleaseType)}>{releaseTypes.map((type) => <option key={type}>{type}</option>)}</select></label></div>
    <section className="form-section"><h2>Tracklist</h2>{!tracks.length ? <><p>No tracks added yet. Add the album's tracklist to enable native ratings.</p><label>Paste tracklist<textarea rows={7} value={tracklistText} onChange={(event) => setTracklistText(event.target.value)} placeholder="One track per line" /></label><button type="button" className="text-button" onClick={addPastedTracks}>Use pasted tracks</button></> : <>{tracks.map((track, index) => <div className="tracklist-editor" key={track.id ?? `new-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><input value={track.title} onChange={(event) => setTracks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} aria-label={`Track ${index + 1} title`} /><button type="button" className="text-button track-move" onClick={() => moveTrack(index, -1)} disabled={index === 0}>↑</button><button type="button" className="text-button track-move" onClick={() => moveTrack(index, 1)} disabled={index === tracks.length - 1}>↓</button><button type="button" className="text-button" onClick={() => setTracks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}<button type="button" className="text-button" onClick={() => setTracks((current) => [...current, { title: "" }])}>+ Add track</button></>}</section>
    {tracks.some((track) => track.id !== undefined) && <section className="form-section"><h2>Track credits</h2><p>Search artists to assign explicit credits.</p>{album.tracks.filter((track) => tracks.some((draft) => draft.id === track.id)).map((track) => <div className="track-credit-editor" key={track.id}><strong>{track.title}</strong><ArtistSearchPicker label="Primary artists" selected={credits[track.id]?.primary ?? []} onChange={(artists) => setTrackCredit(track.id, "primary", artists)} helper="Leave empty to inherit album artists." /><ArtistSearchPicker label="Featured artists" selected={credits[track.id]?.featured ?? []} onChange={(artists) => setTrackCredit(track.id, "featured", artists)} /></div>)}</section>}
    {error && <p className="notice error" role="alert">{error}</p>}<div className="edit-album-actions"><button type="button" className="text-button" onClick={onCancel}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
  </form></main>;
}
