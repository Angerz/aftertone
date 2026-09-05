import { useEffect, useState } from "react";
import { getAlbum } from "../../api/albums";
import { getRevision, listRevisions } from "../../api/revisions";
import type { Album, RatingRevisionDetail, RatingRevisionSummary } from "../../api/types";
import { AlbumCover } from "./AlbumCover";
import { RevisitControls } from "./RevisitControls";
import { RatingHistory, formatRevisionDate } from "../ratings/RatingHistory";
import { RevisionDetailPage } from "../ratings/RevisionDetailPage";

const rating = (value: number | null, digits = 3) => value === null ? "—" : value.toFixed(digits);
const latest = (revisions: RatingRevisionSummary[]) => [...revisions].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime() || right.id - left.id)[0];

function RatingSummary({ revision }: { revision: RatingRevisionDetail }) {
  return <aside className="summary album-rating-summary"><p className="eyebrow">Latest rating</p><p className="summary-date">{formatRevisionDate(revision.created_at)}</p><dl><div><dt>PRE</dt><dd>{rating(revision.pre_rating)}</dd></div><div><dt>Coherence</dt><dd>{rating(revision.coherence, 1)}</dd></div><div><dt>Bad experience</dt><dd>{revision.bad_experience === null ? "—" : `${rating(revision.bad_experience, 2)} %`}</dd></div><div><dt>Emotion</dt><dd>{rating(revision.emotion, 1)}</dd></div><div className="final"><dt>Final</dt><dd>{rating(revision.final_rating)}</dd></div></dl></aside>;
}

export function AlbumPage({ albumId, onBack, onRate, onReconcile }: { albumId: number; onBack: () => void; onRate: () => void; onReconcile: () => void }) {
  const [album, setAlbum] = useState<Album | null>(null); const [revisions, setRevisions] = useState<RatingRevisionSummary[]>([]); const [latestRevision, setLatestRevision] = useState<RatingRevisionDetail | null>(null); const [selectedRevision, setSelectedRevision] = useState<RatingRevisionDetail | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => { let active = true; Promise.all([getAlbum(albumId), listRevisions(albumId)]).then(async ([loadedAlbum, loadedRevisions]) => { if (!active) return; setAlbum(loadedAlbum); setRevisions(loadedRevisions); const revision = latest(loadedRevisions); if (revision) setLatestRevision(await getRevision(albumId, revision.id)); }).catch((cause: Error) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [albumId]);
  async function selectRevision(revisionId: number) { setHistoryLoading(true); setError(null); try { setSelectedRevision(await getRevision(albumId, revisionId)); } catch (cause) { setError((cause as Error).message); } finally { setHistoryLoading(false); } }
  if (loading) return <main className="page"><p>Loading album…</p></main>;
  if (!album) return <main className="page"><button className="back" onClick={onBack}>← Albums</button><p className="notice error">{error || "Album not found."}</p></main>;
  if (selectedRevision) return <RevisionDetailPage album={album} revision={selectedRevision} onBack={() => setSelectedRevision(null)} backLabel="← Back to album" />;
  const pendingLegacy = !latestRevision && album.latest_legacy_rating?.reconciliation_status === "pending";
  const legacyValue = album.latest_legacy_rating?.computed_final_rating ?? album.latest_legacy_rating?.legacy_final_rating;
  return <main className="page album-page"><button className="back" onClick={onBack}>← Library</button><header className="album-page-hero"><AlbumCover album={album} className="album-page-cover" /><div className="album-page-title"><p className="eyebrow">Album journal</p><h1>{album.title}</h1><p className="album-page-artist">{album.artist}</p><p className="album-page-metadata">{album.year ?? "Year unknown"} · {album.release_type}</p>{album.needs_revisit && <p className="revisit-status">Marked for revisit{album.revisit_reason ? ` · ${album.revisit_reason}` : ""}</p>}<button onClick={onRate}>{latestRevision ? "Rate again" : "Rate album"}</button></div>{latestRevision ? <RatingSummary revision={latestRevision} /> : <aside className="album-unrated"><p className="eyebrow">Rating</p><strong>{pendingLegacy ? "Legacy rating" : "Not rated"}</strong>{pendingLegacy && <><b>{rating(legacyValue ?? null)}</b><p>Track mapping pending.</p><button onClick={onReconcile}>Reconcile legacy rating</button></>}</aside>}</header>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="album-page-layout"><section className="album-reading"><h2>{latestRevision?.album_notes ? "Album notes" : "Tracklist"}</h2>{latestRevision?.album_notes && <p className="album-notes">{latestRevision.album_notes}</p>}{latestRevision && <div className="assessment-notes"><section><h3>Coherence <span>{rating(latestRevision.coherence, 1)}</span></h3><p>{latestRevision.coherence_notes || "No notes."}</p></section><section><h3>Emotion <span>{rating(latestRevision.emotion, 1)}</span></h3><p>{latestRevision.emotion_notes || "No notes."}</p></section></div>}<section className="album-tracklist"><h2>{latestRevision?.album_notes ? "Tracklist" : "Tracks"}</h2>{album.tracks.length ? <ol>{album.tracks.map((track) => { const snapshot = latestRevision?.tracks.find((item) => item.track_id === track.id); return <li key={track.id}><div><span>{String(track.position).padStart(2, "0")}</span><strong>{track.title}</strong><b>{snapshot ? snapshot.score === null ? "Unrated" : snapshot.score.toFixed(1) : "—"}</b></div>{snapshot?.notes && <p>{snapshot.notes}</p>}</li>; })}</ol> : <p>{pendingLegacy ? "Tracklist not reconciled yet." : "No tracks recorded."}</p>}</section></section><aside className="album-page-actions"><RevisitControls album={album} onUpdated={setAlbum} /></aside></div>
    {historyLoading && <p>Loading revision…</p>}<RatingHistory revisions={revisions} onSelect={selectRevision} />
  </main>;
}
