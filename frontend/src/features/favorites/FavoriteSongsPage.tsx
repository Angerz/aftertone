import { useEffect, useMemo, useRef, useState } from "react";
import { createFavoriteSong, deleteFavoriteSong, listFavoriteSongs, searchFavoriteTracks, updateFavoriteSong } from "../../api/favoriteSongs";
import type { FavoriteSongEntry, FavoriteSongTrackSearch } from "../../api/types";
import { mediaUrl } from "../../api/client";
import { formatArtistNames } from "../artists/artistDisplay";
import { getRatingTier } from "../albums/ratingTier";
import { favoriteSongScore } from "./favoriteSongCalculator";
import { sortFavoriteSongs, type FavoriteSongSort } from "./favoriteSongSorting";

const criteria = [["base_score", "Puntuación", 10, "How good is this song as an isolated musical work?"], ["emotional_connection", "Conexión emocional", 5, "How different would my life be without this song?"], ["replay_value", "Replay value", 5, "How likely am I to want to hear it completely?"], ["originality", "Originalidad", 5, "How singular does this song feel based on everything I have personally heard?"]] as const;
type Key = (typeof criteria)[number][0]; type Form = Record<Key, string> & { genre: string; notes: string };
const blank = (): Form => ({ base_score: "", emotional_connection: "", replay_value: "", originality: "", genre: "", notes: "" });
const breakdown = [["Puntuación", "base_score", .25], ["Conexión emocional", "emotional_connection", 1], ["Replay value", "replay_value", .2], ["Originalidad", "originality", .2]] as const;
function rankHistory(entry: FavoriteSongEntry) { if (!entry.top_100_entered_at) return null; const days = Math.max(0, Math.floor((Date.now() - new Date(entry.top_100_entered_at).getTime()) / 86_400_000)); const tenure = days === 0 ? "Top 100 today" : `Top 100 · ${days} day${days === 1 ? "" : "s"}`; if (entry.rank_movement === "new") return `New · ${tenure}`; if (entry.rank_movement === "up") return `↑ ${entry.rank_delta} · ${tenure}`; if (entry.rank_movement === "down") return `↓ ${entry.rank_delta} · ${tenure}`; return `— · ${tenure}`; }
function FavoriteRow({ entry, expanded, onToggle, onEdit, onRemove }: { entry: FavoriteSongEntry; expanded: boolean; onToggle: () => void; onEdit: () => void; onRemove: () => void }) { const detailId = `favorite-detail-${entry.id}`; const history = rankHistory(entry); return <li className={expanded ? "expanded" : ""}><button className="favorite-row-toggle" aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}><span className="favorite-rank">#{String(entry.global_position).padStart(2, "0")}</span>{entry.cover_url ? <img src={mediaUrl(entry.cover_url)} alt="" /> : <span className="favorite-cover" />}<span><strong>{entry.track_title}</strong><span>{formatArtistNames(entry.artists)}</span><small>{entry.album_title} · {entry.album_year ?? "—"}{entry.genre && ` · ${entry.genre}`}</small>{history && <small className={`favorite-rank-history ${entry.rank_movement}`}>{history}</small>}</span><b className={`rating-${getRatingTier(entry.final_score)}`}>{entry.final_score.toFixed(2)}</b></button><button className="text-button" onClick={onEdit}>Edit</button><button className="text-button" onClick={onRemove}>Remove</button><div id={detailId} className="favorite-detail" aria-hidden={!expanded}><div><p className="eyebrow">Score breakdown</p>{breakdown.map(([label, key, weight]) => <p key={key}><span>{label}</span><b>{entry[key]}</b><em>+{(entry[key] * weight).toFixed(2)}</em></p>)}<p className="favorite-total"><span>Final</span><b>{entry.final_score.toFixed(2)}</b></p>{entry.notes && <><p className="eyebrow">Personal notes</p><p className="favorite-notes">{entry.notes}</p></>}</div></div></li>; }

function TrackSearchResults({ tracks, onSelect }: { tracks: FavoriteSongTrackSearch[]; onSelect: (track: FavoriteSongTrackSearch) => void }) {
  return <div className="favorite-track-results">{tracks.map((track) => <button className="favorite-search-result" key={track.track_id} disabled={track.already_ranked_position !== null} onClick={() => onSelect(track)}>{track.cover_url && <img src={mediaUrl(track.cover_url)} alt="" />}<span><strong>{track.track_title}</strong><small>{formatArtistNames(track.artists)} · {track.album_title} · {track.album_year ?? "—"}</small></span><em>{track.already_ranked_position ? `Already ranked · #${track.already_ranked_position}` : track.latest_track_score === null ? "Unrated" : `Current score ${track.latest_track_score}`}</em></button>)}</div>;
}

export function FavoriteSongsPage({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<"top" | "candidates">("top"); const [entries, setEntries] = useState<FavoriteSongEntry[]>([]); const [search, setSearch] = useState(""); const [sort, setSort] = useState<FavoriteSongSort>("position"); const [showTrackSearch, setShowTrackSearch] = useState(false); const [query, setQuery] = useState(""); const [tracks, setTracks] = useState<FavoriteSongTrackSearch[]>([]); const [selected, setSelected] = useState<FavoriteSongTrackSearch | null>(null); const [editing, setEditing] = useState<FavoriteSongEntry | null>(null); const [form, setForm] = useState<Form>(blank()); const [error, setError] = useState<string | null>(null); const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const addButtonRef = useRef<HTMLButtonElement>(null); const trackPopoverRef = useRef<HTMLDivElement>(null); const trackInputRef = useRef<HTMLInputElement>(null);
  const reload = () => listFavoriteSongs(view, search).then(setEntries).catch((cause: Error) => setError(cause.message));
  useEffect(() => { reload(); }, [view, search]);
  useEffect(() => { if (!query.trim()) { setTracks([]); return; } const timer = window.setTimeout(() => searchFavoriteTracks(query).then(setTracks).catch((cause: Error) => setError(cause.message)), 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!showTrackSearch) return;
    trackInputRef.current?.focus();
    const closePopover = () => { setShowTrackSearch(false); addButtonRef.current?.focus(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closePopover(); };
    const onPointerDown = (event: MouseEvent) => { if (!trackPopoverRef.current?.contains(event.target as Node) && !addButtonRef.current?.contains(event.target as Node)) closePopover(); };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.removeEventListener("mousedown", onPointerDown); };
  }, [showTrackSearch]);
  const preview = useMemo(() => { const values = criteria.map(([key]) => Number(form[key])); return values.every(Number.isFinite) ? favoriteSongScore(values[0], values[1], values[2], values[3]) : null; }, [form]);
  const selectTrack = (track: FavoriteSongTrackSearch) => { setShowTrackSearch(false); setSelected(track); setEditing(null); setForm({ ...blank(), base_score: track.latest_track_score === null ? "" : String(track.latest_track_score) }); };
  const edit = (entry: FavoriteSongEntry) => { setEditing(entry); setSelected(null); setForm({ base_score: String(entry.base_score), emotional_connection: String(entry.emotional_connection), replay_value: String(entry.replay_value), originality: String(entry.originality), genre: entry.genre ?? "", notes: entry.notes ?? "" }); };
  const closeForm = () => { setSelected(null); setEditing(null); setForm(blank()); };
  async function save() { const values = criteria.map(([key, , max]) => ({ value: Number(form[key]), max })); if (!selected && !editing) return; if (values.some(({ value, max }) => !Number.isFinite(value) || value < 0 || value > max)) { setError("Enter every criterion within its allowed range."); return; } const payload = { base_score: values[0].value, emotional_connection: values[1].value, replay_value: values[2].value, originality: values[3].value, genre: form.genre.trim() || null, notes: form.notes.trim() || null }; try { if (editing) await updateFavoriteSong(editing.id, payload); else await createFavoriteSong({ track_id: selected!.track_id, ...payload }); closeForm(); setQuery(""); reload(); } catch (cause) { setError((cause as Error).message); } }
  const subject = selected ?? editing;
  const displayedEntries = sortFavoriteSongs(entries, sort);

  return <main className="page favorite-songs">
    <button className="back" onClick={onBack}>← Library</button>
    <p className="eyebrow">Favorite songs</p>
    <h1>My favorite songs of all time.</h1>
    <div className="favorite-tabs">
      <button className={view === "top" ? "active" : ""} onClick={() => setView("top")}>Top 100</button>
      <button className={view === "candidates" ? "active" : ""} onClick={() => setView("candidates")}>Candidates</button>
      {!subject && <span className="favorite-add-popover">
        <button ref={addButtonRef} className="favorite-add-button" aria-expanded={showTrackSearch} aria-controls="favorite-track-popover" onClick={() => setShowTrackSearch((visible) => !visible)}>+ Add song</button>
        {showTrackSearch && <div ref={trackPopoverRef} id="favorite-track-popover" className="favorite-track-picker" role="dialog" aria-label="Find an existing track">
          <label className="favorite-track-search">Find an existing track<input ref={trackInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, artist, or album" /></label>
          <TrackSearchResults tracks={tracks} onSelect={selectTrack} />
        </div>}
      </span>}
    </div>
    {error && <p className="notice error">{error}</p>}
    {!subject ? <>
      <div className="favorite-actions">
        <label>Search songs<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search songs..." /></label>
        <label className="favorite-sort">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as FavoriteSongSort)}><option value="position">Position</option><option value="emotional_connection">Emotional connection</option><option value="replay_value">Replay value</option><option value="base_score">Song score</option><option value="originality">Originality</option><option value="title">Title</option></select></label>
      </div>
      {entries.length ? <ol className="favorite-list">{displayedEntries.map((entry) => <FavoriteRow key={entry.id} entry={entry} expanded={expandedIds.has(entry.id)} onToggle={() => setExpandedIds((ids) => { const next = new Set(ids); next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id); return next; })} onEdit={() => edit(entry)} onRemove={() => { if (window.confirm("Remove this song from your favorite-song ranking?")) deleteFavoriteSong(entry.id).then(reload); }} />)}</ol> : <section className="empty"><h2>{view === "top" ? "Your favorite-song ranking is empty." : "Nothing outside the Top 100 yet."}</h2><p>{view === "top" && "Evaluate songs to build your personal Top 100."}</p></section>}
    </> : <section className="favorite-form"><button className="back" onClick={closeForm}>← Back to ranking</button><header className="favorite-song-hero">{subject.cover_url ? <img src={mediaUrl(subject.cover_url)} alt="" /> : <span className="favorite-cover" />}<div><p className="eyebrow">{editing ? "Edit favorite song" : "Add song"}</p><h1>{subject.track_title}</h1><p>{formatArtistNames(subject.artists)}<br />{subject.album_title} · {subject.album_year ?? "—"}</p></div></header><div className="favorite-score-sheet"><section className="favorite-evaluation"><h2>Your evaluation</h2>{criteria.map(([key, label, max, help]) => <label key={key}>{label}<small>{help}</small><input type="number" min="0" max={max} step="0.1" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</section><aside className="favorite-rating-summary"><p className="eyebrow">Calculated rating</p><strong>{preview === null ? "—" : preview.toFixed(2)}</strong><dl>{criteria.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{form[key] || "—"}</dd></div>)}</dl></aside></div><section className="favorite-details"><h2>Additional details</h2><label>Genre<input value={form.genre} onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value }))} /></label><label>Notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label><button onClick={save}>{editing ? "Save changes" : "Add to ranking"}</button></section></section>}
  </main>;
}
