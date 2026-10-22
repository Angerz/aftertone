import { OwnerOnly } from "../auth/Auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFavoriteSong, deleteFavoriteSong, listFavoriteSongs, searchFavoriteTracks, updateFavoriteSong } from "../../api/favoriteSongs";
import type { FavoriteSongEntry, FavoriteSongTrackSearch } from "../../api/types";
import { mediaUrl } from "../../api/client";
import { formatArtistNames } from "../artists/artistDisplay";
import { getRatingTier } from "../albums/ratingTier";
import { nextAftertoneState, notifyNavigationChange } from "../../navigation";
import { favoriteSongCriteria as criteria, validateFavoriteSongCriteria, type FavoriteSongForm as Form } from "./favoriteSongForm";
import { favoriteSongViewQuery, parseFavoriteSongView } from "./favoriteSongNavigation";
import { favoriteSongScore, favoriteSongWeights } from "./favoriteSongCalculator";
import { clearFocusQuery, focusedFavoriteSongReturn, focusQuery, hasFreshFocusedFavoriteSong } from "./favoriteSongFocus";
import { sortFavoriteSongs, type FavoriteSongSort } from "./favoriteSongSorting";
import { FavoriteSongControls } from "./FavoriteSongControls";

const blank = (): Form => ({ base_score: "", emotional_connection: "", replay_value: "", originality: "", genre: "", notes: "" });
const breakdown = [["Puntuación", "base_score"], ["Conexión emocional", "emotional_connection"], ["Replay value", "replay_value"], ["Originalidad", "originality"]] as const;
function rankHistory(entry: FavoriteSongEntry) { if (!entry.top_100_entered_at) return null; const days = Math.max(0, Math.floor((Date.now() - new Date(entry.top_100_entered_at).getTime()) / 86_400_000)); const tenure = days === 0 ? "Top 100 today" : `Top 100 · ${days} day${days === 1 ? "" : "s"}`; if (entry.rank_movement === "new") return `NEW · ${tenure}`; if (entry.rank_movement === "up") return `↑ ${entry.rank_delta} · ${tenure}`; if (entry.rank_movement === "down") return `↓ ${entry.rank_delta} · ${tenure}`; return `— · ${tenure}`; }
function FavoriteRow({ entry, expanded, focused, onToggle, onEdit, onRemove }: { entry: FavoriteSongEntry; expanded: boolean; focused: boolean; onToggle: () => void; onEdit: () => void; onRemove: () => void }) {
  const detailId = `favorite-detail-${entry.id}`; const menuId = `favorite-actions-${entry.id}`; const history = rankHistory(entry); const [showActions, setShowActions] = useState(false); const actionsButtonRef = useRef<HTMLButtonElement>(null); const actionsMenuRef = useRef<HTMLDivElement>(null); const removeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showActions) return;
    removeButtonRef.current?.focus();
    const close = () => { setShowActions(false); actionsButtonRef.current?.focus(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const onPointerDown = (event: MouseEvent) => { if (!actionsMenuRef.current?.contains(event.target as Node) && !actionsButtonRef.current?.contains(event.target as Node)) close(); };
    document.addEventListener("keydown", onKeyDown); document.addEventListener("mousedown", onPointerDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.removeEventListener("mousedown", onPointerDown); };
  }, [showActions]);
  return <li id={`favorite-song-${entry.id}`} className={`${expanded ? "expanded " : ""}${focused ? "favorite-song-focused" : ""}`}><button className="favorite-row-toggle" aria-expanded={expanded} aria-controls={detailId} onClick={onToggle}><span className="favorite-rank">#{String(entry.global_position).padStart(2, "0")}</span>{entry.cover_url ? <img src={mediaUrl(entry.cover_url)} alt="" /> : <span className="favorite-cover" />}<span className="favorite-row-copy"><strong>{entry.track_title}</strong><span>{formatArtistNames(entry.artists)}</span><small className="favorite-song-meta">{entry.album_title} · {entry.album_year ?? "—"}{entry.genre && ` · ${entry.genre}`}</small>{history && <small className={`favorite-rank-history ${entry.rank_movement}`} title={history}>{history}</small>}</span><span className="favorite-row-score"><b className={`rating-${getRatingTier(entry.final_score)}`}>{entry.final_score.toFixed(2)}</b><svg className="favorite-row-chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span></button><OwnerOnly><button className="text-button" onClick={onEdit}>Edit</button><span className="favorite-row-actions"><button ref={actionsButtonRef} className="icon-button favorite-row-more" aria-label={`More actions for ${entry.track_title}`} aria-expanded={showActions} aria-controls={menuId} onClick={() => setShowActions((visible) => !visible)}>···</button>{showActions && <div ref={actionsMenuRef} id={menuId} className="favorite-row-menu" role="menu" aria-label={`Actions for ${entry.track_title}`}><button ref={removeButtonRef} role="menuitem" onClick={() => { setShowActions(false); onRemove(); }}>Remove from Favorite Songs</button></div>}</span></OwnerOnly><div id={detailId} className="favorite-detail" aria-hidden={!expanded}><div><p className="eyebrow">Score breakdown</p><p className="favorite-song-context">{entry.album_title} · {entry.album_year ?? "—"}{entry.genre && ` · ${entry.genre}`}</p>{breakdown.map(([label, key]) => <p key={key}><span>{label}</span><b>{entry[key]}</b><em aria-label={`Weighted contribution: ${(entry[key] * favoriteSongWeights[key]).toFixed(2)}`}>+{(entry[key] * favoriteSongWeights[key]).toFixed(2)}</em></p>)}<p className="favorite-total"><span>Final</span><b>{entry.final_score.toFixed(2)}</b></p>{entry.notes && <><p className="eyebrow">Personal notes</p><p className="favorite-notes">{entry.notes}</p></>}</div></div></li>;
}

function TrackSearchResults({ tracks, onSelect }: { tracks: FavoriteSongTrackSearch[]; onSelect: (track: FavoriteSongTrackSearch) => void }) {
  return <div className="favorite-track-results">{tracks.map((track) => <button className="favorite-search-result" key={track.track_id} disabled={track.already_ranked_position !== null} onClick={() => onSelect(track)}>{track.cover_url && <img src={mediaUrl(track.cover_url)} alt="" />}<span><strong>{track.track_title}</strong><small>{formatArtistNames(track.artists)} · {track.album_title} · {track.album_year ?? "—"}</small></span><em>{track.already_ranked_position ? `Already ranked · #${track.already_ranked_position}` : track.latest_track_score === null ? "Unrated" : `Current score ${track.latest_track_score}`}</em></button>)}</div>;
}

export function FavoriteSongsPage() {
  const [view, setView] = useState(() => parseFavoriteSongView(window.location.search)); const [entries, setEntries] = useState<FavoriteSongEntry[]>([]); const [search, setSearch] = useState(""); const [sort, setSort] = useState<FavoriteSongSort>("position"); const [showTrackSearch, setShowTrackSearch] = useState(false); const [query, setQuery] = useState(""); const [tracks, setTracks] = useState<FavoriteSongTrackSearch[]>([]); const [selected, setSelected] = useState<FavoriteSongTrackSearch | null>(null); const [editing, setEditing] = useState<FavoriteSongEntry | null>(null); const [form, setForm] = useState<Form>(blank()); const [error, setError] = useState<string | null>(null); const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set()); const [reloadVersion, setReloadVersion] = useState(0); const [loadedView, setLoadedView] = useState<"top" | "candidates" | null>(null); const [loadedSearch, setLoadedSearch] = useState<string | null>(null); const [loadError, setLoadError] = useState<string | null>(null); const [showValidation, setShowValidation] = useState(false); const [loadedVersion, setLoadedVersion] = useState<number | null>(null); const [focusRequiredVersion, setFocusRequiredVersion] = useState<number | null>(null); const [focusEntryId, setFocusEntryId] = useState<number | null>(() => { const id = Number(new URLSearchParams(window.location.search).get("focus")); return Number.isInteger(id) && id > 0 ? id : null; }); const [highlightedEntryId, setHighlightedEntryId] = useState<number | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null); const trackPopoverRef = useRef<HTMLDivElement>(null); const trackInputRef = useRef<HTMLInputElement>(null); const focusViewsTried = useRef(new Set<"top" | "candidates">());
  const reload = () => setReloadVersion((version) => version + 1);
  const loading = loadedView !== view || loadedVersion !== reloadVersion || loadedSearch !== search;
  const chooseView = (next: "top" | "candidates") => {
    if (next === view) return;
    const query = clearFocusQuery(favoriteSongViewQuery(window.location.search, next));
    window.history.pushState(nextAftertoneState(window.history.state), "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    setView(next);
    setFocusEntryId(null);
    setFocusRequiredVersion(null);
    focusViewsTried.current.clear();
    notifyNavigationChange();
  };
  useEffect(() => {
    const onPopState = () => {
      setView(parseFavoriteSongView(window.location.search));
      const id = Number(new URLSearchParams(window.location.search).get("focus"));
      setFocusEntryId(Number.isInteger(id) && id > 0 ? id : null);
      setFocusRequiredVersion(null);
      focusViewsTried.current.clear();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => { let active = true; const requestVersion = reloadVersion; setLoadError(null); listFavoriteSongs(view, search).then((rows) => { if (active) { setEntries(rows); setLoadedView(view); setLoadedSearch(search); setLoadedVersion(requestVersion); } }).catch((cause: Error) => { if (active) setLoadError(cause.message); }); return () => { active = false; }; }, [view, search, reloadVersion]);
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
  useEffect(() => {
    if (loading || loadError || focusEntryId === null || selected || editing || loadedView !== view || (focusRequiredVersion !== null && loadedVersion !== focusRequiredVersion)) return;
    if (!hasFreshFocusedFavoriteSong({ entryId: focusEntryId, entries, view, loadedView, loadedVersion, requiredVersion: focusRequiredVersion })) {
      if (!focusViewsTried.current.has(view)) {
        focusViewsTried.current.add(view);
        const next = view === "top" ? "candidates" : "top";
        const query = favoriteSongViewQuery(window.location.search, next);
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
        setView(next);
      }
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`favorite-song-${focusEntryId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      setHighlightedEntryId(focusEntryId);
      const query = clearFocusQuery(window.location.search);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      setFocusEntryId(null);
      setFocusRequiredVersion(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entries, focusEntryId, selected, editing, loadedView, loadedVersion, focusRequiredVersion, view, loading, loadError]);
  useEffect(() => { if (highlightedEntryId === null) return; const timer = window.setTimeout(() => setHighlightedEntryId(null), 1800); return () => window.clearTimeout(timer); }, [highlightedEntryId]);
  const validation = useMemo(() => validateFavoriteSongCriteria(form), [form]);
  const values = validation.values;
  const preview = values ? favoriteSongScore(values.base_score, values.emotional_connection, values.replay_value, values.originality) : null;
  const selectTrack = (track: FavoriteSongTrackSearch) => { setShowValidation(false); setShowTrackSearch(false); setSelected(track); setEditing(null); setForm({ ...blank(), base_score: track.latest_track_score === null ? "" : String(track.latest_track_score) }); };
  const edit = (entry: FavoriteSongEntry) => { setShowValidation(false); setEditing(entry); setSelected(null); setForm({ base_score: String(entry.base_score), emotional_connection: String(entry.emotional_connection), replay_value: String(entry.replay_value), originality: String(entry.originality), genre: entry.genre ?? "", notes: entry.notes ?? "" }); };
  const closeForm = () => { setShowValidation(false); setSelected(null); setEditing(null); setForm(blank()); };
  async function save() {
    if (!selected && !editing) return;
    if (!values) {
      setShowValidation(true);
      const invalid = criteria.find(([key]) => validation.errors[key]);
      if (invalid) document.getElementById(`favorite-${invalid[0]}`)?.focus();
      return;
    }
    const payload = { ...values, genre: form.genre.trim() || null, notes: form.notes.trim() || null };
    try {
      const updated = editing ? await updateFavoriteSong(editing.id, payload) : await createFavoriteSong({ track_id: selected!.track_id, ...payload });
      if (editing) {
        const focus = focusedFavoriteSongReturn(updated);
        const query = focusQuery(favoriteSongViewQuery(window.location.search, focus.view), focus.entryId);
        const nextVersion = reloadVersion + 1;
        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
        focusViewsTried.current.clear();
        setSearch(focus.search);
        setView(focus.view);
        setFocusEntryId(focus.entryId);
        setFocusRequiredVersion(nextVersion);
        setReloadVersion(nextVersion);
      } else reload();
      closeForm();
      setQuery("");
    } catch (cause) { setError((cause as Error).message); }
  }
  const subject = selected ?? editing;
  const displayedEntries = sortFavoriteSongs(entries, sort);

  return <main className="page favorite-songs">
    <h1>My favorite songs of all time.</h1>
    <div className="favorite-tabs" role="group" aria-label="Favorite-song ranking view">
      <div className="favorite-view-tabs"><button className={view === "top" ? "active" : ""} aria-pressed={view === "top"} onClick={() => chooseView("top")}>Top 100</button>
      <button className={view === "candidates" ? "active" : ""} aria-pressed={view === "candidates"} onClick={() => chooseView("candidates")}>Candidates</button></div>
      {!subject && <OwnerOnly><span className="favorite-add-popover">
        <button ref={addButtonRef} className="favorite-add-button" aria-expanded={showTrackSearch} aria-controls="favorite-track-popover" onClick={() => setShowTrackSearch((visible) => !visible)}>+ Add song</button>
        {showTrackSearch && <div ref={trackPopoverRef} id="favorite-track-popover" className="favorite-track-picker" role="dialog" aria-label="Find an existing track">
          <label className="favorite-track-search">Find an existing track<input ref={trackInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, artist, or album" /></label>
          <TrackSearchResults tracks={tracks} onSelect={selectTrack} />
        </div>}
      </span></OwnerOnly>}
    </div>
    {(error || loadError) && <p className="notice error" role="alert">{error || loadError}</p>}
    {!subject ? <>
      <FavoriteSongControls search={search} sort={sort} onSearch={setSearch} onSort={setSort} />
      {loadError ? null : loading ? <p role="status">Loading favorite songs…</p> : entries.length ? <ol className="favorite-list">{displayedEntries.map((entry) => <FavoriteRow key={entry.id} entry={entry} expanded={expandedIds.has(entry.id)} focused={highlightedEntryId === entry.id} onToggle={() => setExpandedIds((ids) => { const next = new Set(ids); next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id); return next; })} onEdit={() => edit(entry)} onRemove={() => { if (window.confirm("Remove this song from your favorite-song ranking?")) deleteFavoriteSong(entry.id).then(reload).catch((cause: Error) => setError(cause.message)); }} />)}</ol> : <section className="empty"><h2>{view === "top" ? "Your favorite-song ranking is empty." : "Nothing outside the Top 100 yet."}</h2><p>{view === "top" && "Evaluate songs to build your personal Top 100."}</p></section>}
    </> : <section className="favorite-form"><button className="back" onClick={closeForm}>← Back to ranking</button><header className="favorite-song-hero">{subject.cover_url ? <img src={mediaUrl(subject.cover_url)} alt="" /> : <span className="favorite-cover" />}<div><p className="eyebrow">{editing ? "Edit favorite song" : "Add song"}</p><h1>{subject.track_title}</h1><p>{formatArtistNames(subject.artists)}<br />{subject.album_title} · {subject.album_year ?? "—"}</p></div></header><div className="favorite-score-sheet"><section className="favorite-evaluation"><h2>Your evaluation</h2>{criteria.map(([key, label, max, help]) => <label key={key} htmlFor={`favorite-${key}`}>{label}<small id={`favorite-${key}-help`}>{help}</small><input id={`favorite-${key}`} aria-label={label} type="number" inputMode="decimal" required min="0" max={max} step="0.1" value={form[key]} aria-invalid={showValidation && Boolean(validation.errors[key])} aria-describedby={`favorite-${key}-help${showValidation && validation.errors[key] ? ` favorite-${key}-error` : ""}`} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />{showValidation && validation.errors[key] && <small className="field-error" id={`favorite-${key}-error`}>{validation.errors[key]}</small>}</label>)}</section><aside className="favorite-rating-summary"><p className="eyebrow">Calculated rating</p><strong>{preview === null ? "—" : preview.toFixed(2)}</strong><dl>{criteria.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{form[key] || "—"}</dd></div>)}</dl></aside></div><section className="favorite-details"><h2>Additional details</h2><label>Genre<input value={form.genre} onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value }))} /></label><label>Notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label><button onClick={save}>{editing ? "Save changes" : "Add to ranking"}</button></section></section>}
  </main>;
}
