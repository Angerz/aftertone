import { useEffect, useState } from "react";
import { getAlbum } from "../../api/albums";
import { getLegacyRating, previewLegacyReconciliation, reconcileLegacyRating } from "../../api/legacy";
import type { Album, LegacyRatingDetail } from "../../api/types";
import { parseTracklist } from "./tracklist";

export function LegacyReconciliationPage({ albumId, onBack, onReconciled }: { albumId: number; onBack: () => void; onReconciled: () => void }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [legacy, setLegacy] = useState<LegacyRatingDetail | null>(null);
  const [tracklistText, setTracklistText] = useState("");
  const [mappings, setMappings] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ pre_rating: number | null; bad_experience: number | null; final_rating: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(true);

  useEffect(() => {
    getAlbum(albumId).then(async (loaded) => {
      setAlbum(loaded); setTracklistText(loaded.tracks.map((track) => track.title).join("\n"));
      if (!loaded.latest_legacy_rating) throw new Error("No legacy rating is available.");
      const detail = await getLegacyRating(loaded.latest_legacy_rating.id);
      setLegacy(detail); setMappings(detail.extracted_scores.map(() => ""));
    }).catch((cause: Error) => setError(cause.message)).finally(() => setBusy(false));
  }, [albumId]);

  const parsedTracklist = parseTracklist(tracklistText);
  const tracks = album?.tracks.length ? album.tracks : parsedTracklist.map((title, index) => ({ id: index + 1, position: index + 1, title }));
  const mapped = mappings.filter(Boolean).length;
  const valid = legacy && mapped === legacy.extracted_scores.length && new Set(mappings).size === mappings.length && tracks.length > 0;
  const payload = () => mappings.map((trackId, index) => ({ legacy_score_index: index, track_id: Number(trackId) }));
  const trackTitles = () => album?.tracks.length ? [] : parsedTracklist;
  async function calculatePreview() {
    if (!legacy || !valid) return;
    setBusy(true); setError(null);
    try { setPreview(await previewLegacyReconciliation(legacy.id, trackTitles(), payload())); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!legacy || !valid) return;
    setBusy(true);
    try { await reconcileLegacyRating(legacy.id, trackTitles(), payload()); onReconciled(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  if (busy && !album) return <main className="page"><p>Loading reconciliation…</p></main>;
  if (error && !album) return <main className="page"><button className="back" onClick={onBack}>← Album</button><p className="notice error">{error}</p></main>;
  return <main className="page narrow reconciliation-page"><button className="back" onClick={onBack}>← Album</button><p className="eyebrow">Legacy reconciliation</p><h1>{album?.title}</h1>{error && <p className="notice error reconciliation-feedback">{error}</p>}
    <section className="form-section reconciliation-step"><h2>1. Real tracklist</h2>{album && !album.tracks.length && <><p className="reconciliation-helper">Add one real track per line. Tracks are created only when reconciliation is confirmed.</p><textarea rows={5} value={tracklistText} onChange={(event) => { setTracklistText(event.target.value); setPreview(null); }} placeholder="One track per line" /></>}{album?.tracks.length ? <p className="reconciliation-helper">Using the existing real tracklist.</p> : null}</section>
    <section className="form-section reconciliation-step"><h2>2. Map legacy scores manually</h2><p className="reconciliation-helper">Assigned {mapped} / {legacy?.extracted_scores.length ?? 0} · Unrated tracks: {Math.max(0, tracks.length - mapped)}</p><div className="reconciliation-mappings">{legacy?.extracted_scores.map((score, index) => <label key={index}>Legacy score {index + 1} — {score}<select value={mappings[index] ?? ""} onChange={(event) => { setMappings((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value)); setPreview(null); }}><option value="">Choose a real track</option>{tracks.map((track) => <option key={track.id} value={track.id}>{track.position}. {track.title}</option>)}</select></label>)}</div></section>
    <section className="form-section reconciliation-step reconciliation-confirm"><h2>3. Preview and confirm</h2><p className="reconciliation-helper">All legacy scores must be assigned once. Unmapped real tracks remain explicitly unrated, not scored zero.</p><div className="reconciliation-preview-action"><button className="secondary-button" onClick={calculatePreview} disabled={!valid || busy}>Calculate authoritative preview</button></div>{preview && <aside className="reconciliation-preview"><p className="eyebrow">Preview</p><dl><div><dt>PRE</dt><dd>{preview.pre_rating ?? "—"}</dd></div><div><dt>Bad experience</dt><dd>{preview.bad_experience ?? "—"}</dd></div><div><dt>Final</dt><dd>{preview.final_rating ?? "—"}</dd></div><div><dt>Legacy final</dt><dd>{legacy?.legacy_final_rating ?? "—"}</dd></div></dl></aside>}<div className="reconciliation-commit"><p>When the mapping is ready, create the immutable native revision.</p><button onClick={confirm} disabled={!valid || busy}>{busy ? "Reconciling…" : "Create native revision"}</button></div></section>
  </main>;
}
