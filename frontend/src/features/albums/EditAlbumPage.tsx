import { type FormEvent, lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { getAlbum, importAlbumCoverFromUrl, updateAlbum, updateTrackArtists } from "../../api/albums";
import type { Album, AlbumUpdate, Artist, ReleaseType, TrackUpdate } from "../../api/types";
import { AlbumCover } from "./AlbumCover";
import { ApiError } from "../../api/client";
import { AlbumMetadataSection } from "./AlbumMetadataSection";
import { albumMetadataErrorTarget, validateAlbumMetadata, type AlbumMetadataField, type AlbumMetadataTarget } from "./albumMetadataValidation";
import { CoverControls } from "./CoverControls";
import { TrackCreditEditor } from "./TrackCreditEditor";
import { albumTrackDrafts, trackUpdatePayload, type AlbumTrackDraft } from "./albumTrackDraft";
import "./editAlbumMobile.css";
import { canUseDiscCount, moveTrackWithinDisc, parseTracklistText } from "./tracklistEditor";
import { MusicBrainzAlbumEnrichment } from "./MusicBrainzAlbumEnrichment";
import { musicBrainzTracklist } from "./musicbrainz";
import { useUnsavedNavigation } from "../../components/useUnsavedNavigation";

const MobileAlbumTracklist = lazy(() => import("./MobileAlbumTracklist").then((module) => ({ default: module.MobileAlbumTracklist })));

const releaseTypes: ReleaseType[] = ["album", "soundtrack", "single", "unknown", "ep", "mixtape", "compilation", "live", "reissue"];
type Credits = Record<number, { primary: Artist[]; featured: Artist[] }>;

function draftFingerprint(title: string, artists: string[], year: string, releaseDate: string, releaseType: ReleaseType, discCount: number, tracks: TrackUpdate[], credits: Credits, musicBrainzReleaseId: string | null) {
  return JSON.stringify({
    title,
    artists,
    year,
    releaseDate,
    releaseType,
    discCount,
    tracks: tracks.map(({ id, disc_number, title: trackTitle }) => ({ id, disc_number, title: trackTitle })),
    credits: Object.entries(credits).sort(([left], [right]) => Number(left) - Number(right)).map(([trackId, value]) => [trackId, value.primary.map((artist) => artist.id), value.featured.map((artist) => artist.id)]),
    musicBrainzReleaseId,
  });
}

export function EditAlbumPage({ albumId, onCancel, onSaved }: { albumId: number; onCancel: () => void; onSaved: () => void }) {
  const [album, setAlbum] = useState<Album | null>(null); const [title, setTitle] = useState(""); const [artists, setArtists] = useState<string[]>([]); const [year, setYear] = useState(""); const [releaseDate, setReleaseDate] = useState(""); const [releaseType, setReleaseType] = useState<ReleaseType>("album"); const [discCount, setDiscCount] = useState(1);
  const [tracks, setTracks] = useState<AlbumTrackDraft[]>([]); const [tracklistText, setTracklistText] = useState(""); const [credits, setCredits] = useState<Credits>({}); const [musicBrainzReleaseId, setMusicBrainzReleaseId] = useState<string | null>(null); const [initialDraft, setInitialDraft] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataIssue, setMetadataIssue] = useState<AlbumMetadataTarget | null>(null);
  const [metadataFocus, setMetadataFocus] = useState<AlbumMetadataTarget | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const metadataErrorId = useId();
  useLayoutEffect(() => {
    if (!metadataFocus) return;
    const fields = formRef.current?.querySelectorAll<HTMLElement>(`[name="${metadataFocus.field}"]`);
    (fields?.[metadataFocus.artistIndex ?? 0] ?? formRef.current?.querySelector<HTMLElement>("[data-add-artist]"))?.focus();
    setMetadataFocus(null);
  }, [metadataFocus]);
  useEffect(() => { setMetadataOpen(false); setMetadataIssue(null); getAlbum(albumId).then((loaded) => {
    const loadedArtists = loaded.artists.map((artist) => artist.name); const loadedYear = loaded.year?.toString() ?? ""; const loadedReleaseDate = loaded.release_date ?? ""; const loadedTracks = albumTrackDrafts(loaded.tracks.map((track) => ({ id: track.id, disc_number: track.disc_number, title: track.title }))); const loadedCredits = Object.fromEntries(loaded.tracks.map((track) => [track.id, { primary: track.uses_album_artists ? [] : track.primary_artists, featured: track.featured_artists }])); const loadedMusicBrainzReleaseId = loaded.musicbrainz_release_id ?? null;
    setAlbum(loaded); setTitle(loaded.title); setArtists(loadedArtists); setYear(loadedYear); setReleaseDate(loadedReleaseDate); setReleaseType(loaded.release_type); setDiscCount(loaded.disc_count); setTracks(loadedTracks); setCredits(loadedCredits); setMusicBrainzReleaseId(loadedMusicBrainzReleaseId); setInitialDraft(draftFingerprint(loaded.title, loadedArtists, loadedYear, loadedReleaseDate, loaded.release_type, loaded.disc_count, loadedTracks, loadedCredits, loadedMusicBrainzReleaseId));
  }).catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false)); }, [albumId]);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const dirty = initialDraft !== null && initialDraft !== draftFingerprint(title, artists, year, releaseDate, releaseType, discCount, tracks, credits, musicBrainzReleaseId);
  useUnsavedNavigation(dirty, "Discard unsaved album changes?");
  const cancel = () => { if (!dirty || window.confirm("Discard unsaved album changes?")) onCancel(); };
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const metadataField = (field: AlbumMetadataField, artistIndex = 0) => {
    const invalid = mobile && metadataIssue?.field === field && (field !== "artists" || artistIndex === (metadataIssue.artistIndex ?? 0));
    return { name: field, "aria-invalid": invalid || undefined, "aria-describedby": invalid ? metadataErrorId : undefined };
  };
  const reportMetadataError = (message: string, target: AlbumMetadataTarget) => {
    const editableTarget: AlbumMetadataTarget = target.field === "year" && releaseDate ? { field: "release_date" } : target;
    setError(message); setMetadataIssue(editableTarget);
    if (mobile) { setMetadataOpen(true); setMetadataFocus({ ...editableTarget }); }
  };
  const setTrackCredit = (trackId: number, kind: "primary" | "featured", selected: Artist[]) => setCredits((current) => ({ ...current, [trackId]: { ...current[trackId], [kind]: selected } }));
  const moveTrack = (index: number, direction: -1 | 1) => setTracks((current) => moveTrackWithinDisc(current, index, direction));
  const changeDiscCount = (value: string) => { const next = Number(value); if (!Number.isInteger(next) || next < 1 || next > 99) return; if (!canUseDiscCount(tracks, next)) { reportMetadataError(`Cannot reduce disc count while Disc ${next + 1} or later contains tracks. Move or delete those tracks first.`, { field: "disc_count" }); return; } setError(null); setMetadataIssue(null); setDiscCount(next); };
  const addPastedTracks = () => setTracks(albumTrackDrafts(parseTracklistText(tracklistText)));
  async function submit(event: FormEvent) { event.preventDefault(); setError(null); setMetadataIssue(null); const parsedYear = year ? Number(year) : null; const cleanArtists = artists.map((artist) => artist.trim()).filter(Boolean); const issue = validateAlbumMetadata(title, artists, year); if (issue) { reportMetadataError(issue.message, issue); return; } if (!tracks.length || tracks.some((track) => !track.title.trim())) { setError("Add at least one track with a title."); return; }
    const orderedTracks = Array.from({ length: discCount }, (_, discIndex) => tracks.filter((track) => track.disc_number === discIndex + 1)).flat(); const payload: AlbumUpdate = { title: title.trim(), artists: cleanArtists.map((name) => ({ name })), year: parsedYear, release_date: releaseDate || null, release_type: releaseType, disc_count: discCount, tracks: trackUpdatePayload(orderedTracks), musicbrainz_release_id: musicBrainzReleaseId };
    setSaving(true); try { const saved = await updateAlbum(albumId, payload); const savedIds = new Set(saved.tracks.map((track) => track.id)); await Promise.all(Object.entries(credits).filter(([trackId]) => savedIds.has(Number(trackId))).map(([trackId, value]) => updateTrackArtists(Number(trackId), { primary_artist_ids: value.primary.map((artist) => artist.id), featured_artist_ids: value.featured.map((artist) => artist.id) }))); onSaved(); } catch (cause) {
      const target = cause instanceof ApiError ? albumMetadataErrorTarget(cause.validationPaths) : null;
      if (target) {
        if (target.field === "artists") {
          const nonEmptyIndices = artists.flatMap((artist, index) => artist.trim() ? [index] : []);
          target.artistIndex = nonEmptyIndices[target.artistIndex ?? 0] ?? 0;
        }
        reportMetadataError((cause as Error).message, target);
      } else setError((cause as Error).message);
    } finally { setSaving(false); }
  }
  if (loading) return <main className="page"><p>Loading album…</p></main>; if (!album) return <main className="page"><button className="back" onClick={cancel}>← Album</button><p className="notice error">{error || "Album not found."}</p></main>;
  return <main className="page narrow edit-album-page"><button className="back" onClick={cancel}>← Album</button><p className="eyebrow">Album metadata</p><h1>Edit album</h1><form ref={formRef} onSubmit={submit} noValidate><AlbumMetadataSection open={metadataOpen} onToggle={() => setMetadataOpen((current) => !current)} title={title} artists={artists} year={year} releaseType={releaseType} discCount={discCount} error={metadataIssue ? error : null} errorId={metadataErrorId}><div className="edit-album-cover"><AlbumCover album={album} className="edit-cover" /><div><h2>Cover art</h2><CoverControls album={album} onUpdated={setAlbum} compactMobile /></div></div>
    <div className="metadata"><label>Title<input {...metadataField("title")} value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div><p className="eyebrow">Artists</p>{artists.map((artist, index) => <div className="artist-input" key={index}><input {...metadataField("artists", index)} aria-label={`Album artist ${index + 1}`} value={artist} onChange={(event) => setArtists((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} />{artists.length > 1 && <button type="button" className="icon-button" aria-label={`Remove album artist ${index + 1}`} onClick={() => setArtists((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div>)}<button type="button" className="text-button" data-add-artist onClick={() => setArtists((current) => [...current, ""])}>+ Add artist</button></div><label>Year only<input {...metadataField("year")} type="number" min="1000" max="3000" value={year} disabled={Boolean(releaseDate)} onChange={(event) => setYear(event.target.value)} /><small>{releaseDate ? "Derived from the exact release date." : "Use this when the month and day are unknown."}</small></label><label><span className="field-label">Exact release date <em className="field-optional">(optional)</em></span><input {...metadataField("release_date")} type="date" value={releaseDate} onChange={(event) => { const next = event.target.value; setReleaseDate(next); if (next) setYear(next.slice(0, 4)); }} /></label><label>Release type<select {...metadataField("release_type")} value={releaseType} onChange={(event) => setReleaseType(event.target.value as ReleaseType)}>{releaseTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Number of discs<input {...metadataField("disc_count")} type="number" min="1" max="99" value={discCount} onChange={(event) => changeDiscCount(event.target.value)} /></label></div>
    </AlbumMetadataSection>
    <MusicBrainzAlbumEnrichment title={title} artists={artists} onUseTracklist={(preview) => { setTracks(albumTrackDrafts(musicBrainzTracklist(preview))); setDiscCount(preview.disc_count); setMusicBrainzReleaseId(preview.musicbrainz_release_id); if (!releaseDate && preview.release_date) { setReleaseDate(preview.release_date); setYear(preview.release_date.slice(0, 4)); } setCredits({}); setError(null); setMetadataIssue(null); }} onImportCover={async (url) => setAlbum(await importAlbumCoverFromUrl(album.id, url))} />
    <section className="form-section"><h2>Tracklist</h2>{!tracks.length ? <><p>No tracks added yet. Add the album's tracklist to enable native ratings.</p><label>Paste tracklist<textarea rows={7} value={tracklistText} onChange={(event) => setTracklistText(event.target.value)} placeholder="One track per line" /></label><button type="button" className="text-button" onClick={addPastedTracks}>Use pasted tracks</button></> : mobile ? <Suspense fallback={<p className="mobile-track-help" role="status">Loading tracklist…</p>}><MobileAlbumTracklist tracks={tracks} discCount={discCount} onChange={setTracks} /></Suspense> : Array.from({ length: discCount }, (_, discIndex) => { const disc = discIndex + 1; const discTracks = tracks.flatMap((track, index) => track.disc_number === disc ? [{ track, index }] : []); return <section className="track-disc-editor" key={disc}>{discCount > 1 && <h3>Disc {disc}</h3>}{discTracks.map(({ track, index }, localIndex) => <div className="tracklist-editor" key={track.editorKey}><span>{String(localIndex + 1).padStart(2, "0")}</span><input value={track.title} aria-label={`Disc ${disc} track ${localIndex + 1} title`} onChange={(event) => setTracks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /><div className="track-editor-actions">{discCount > 1 && <select aria-label={`Move ${track.title || "track"} to disc`} value={track.disc_number} onChange={(event) => setTracks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, disc_number: Number(event.target.value) } : item))}>{Array.from({ length: discCount }, (_, targetIndex) => <option key={targetIndex} value={targetIndex + 1}>Disc {targetIndex + 1}</option>)}</select>}<button type="button" className="text-button track-move" aria-label={`Move disc ${disc} track ${localIndex + 1} up`} title="Move track up" onClick={() => moveTrack(index, -1)} disabled={localIndex === 0}>↑</button><button type="button" className="text-button track-move" aria-label={`Move disc ${disc} track ${localIndex + 1} down`} title="Move track down" onClick={() => moveTrack(index, 1)} disabled={localIndex === discTracks.length - 1}>↓</button><button type="button" className="text-button track-remove" aria-label={`Remove disc ${disc} track ${localIndex + 1}`} onClick={() => setTracks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div></div>)}<button type="button" className="text-button" onClick={() => setTracks((current) => [...current, ...albumTrackDrafts([{ disc_number: disc, title: "" }])])}>+ Add track</button></section>; })}</section>
    {tracks.some((track) => track.id !== undefined) && <section className="form-section"><h2>Track credits</h2><p>Search artists to assign explicit credits.</p>{Array.from({ length: discCount }, (_, i) => i + 1).flatMap((disc) => {
      const members = tracks.filter((track) => track.disc_number === disc);
      return [discCount > 1 && members.some((track) => track.id !== undefined) ? <h3 className="credit-disc-heading" key={`credit-disc-${disc}`}>Disc {disc}</h3> : null, ...members.flatMap((track, index) => {
        const savedTrack = album.tracks.find((item) => item.id === track.id);
        if (!savedTrack) return [];
        return [<TrackCreditEditor key={savedTrack.id} title={track.title} savedTitle={savedTrack.title} number={index + 1} primary={credits[savedTrack.id]?.primary ?? []} featured={credits[savedTrack.id]?.featured ?? []} onChange={(kind, selected) => setTrackCredit(savedTrack.id, kind, selected)} />];
      })];
    })}</section>}{error && (!mobile || !metadataIssue) && <p className="notice error" role="alert">{error}</p>}<div className="edit-album-actions"><button type="button" className="text-button" onClick={cancel}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
  </form></main>;
}
