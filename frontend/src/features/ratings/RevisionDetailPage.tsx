import type { Album, RatingRevisionDetail } from "../../api/types";
import { formatRevisionDate } from "./RatingHistory";

const rating = (value: number | null, digits = 3) => value === null ? "—" : value.toFixed(digits);
function SnapshotNotes({ title, notes }: { title: string; notes: string | null }) { return <section className="snapshot-notes"><h2>{title}</h2><p>{notes || "No notes."}</p></section>; }

export function RevisionDetailPage({ album, revision, onBack, backLabel = "← Back to current rating" }: { album: Album; revision: RatingRevisionDetail; onBack: () => void; backLabel?: string }) {
  return <main className="page editor revision-detail"><button className="back" onClick={onBack}>{backLabel}</button><header className="album-header"><p className="eyebrow">Historical snapshot</p><h1>{album.title}</h1><p>Viewing revision from {formatRevisionDate(revision.created_at)} · {album.artist}</p></header>
    <div className="detail-layout"><section><h2>Tracks</h2>{revision.tracks.map((track) => <article className="snapshot-track" key={track.track_id}><h3><span>{String(track.position).padStart(2, "0")}</span>{track.title}</h3><p className="snapshot-score">Rating <strong>{track.score === null ? "Unrated" : track.score.toFixed(1)}</strong> · {track.include_in_pre_rating ? "Included in PRE" : "Excluded from PRE"}</p><p className="snapshot-copy">{track.notes || "No notes."}</p></article>)}</section>
      <aside className="summary"><h2>Revision summary</h2><dl><div><dt>PRE</dt><dd>{rating(revision.pre_rating)}</dd></div><div><dt>Coherence</dt><dd>{rating(revision.coherence, 1)}</dd></div><div><dt>Bad experience</dt><dd>{revision.bad_experience === null ? "—" : `${rating(revision.bad_experience, 2)} %`}</dd></div><div><dt>Emotion</dt><dd>{rating(revision.emotion, 1)}</dd></div><div className="final"><dt>Final rating</dt><dd>{rating(revision.final_rating)}</dd></div></dl></aside>
    </div><div className="snapshot-notes-grid"><SnapshotNotes title="Coherence notes" notes={revision.coherence_notes} /><SnapshotNotes title="Emotion notes" notes={revision.emotion_notes} /><SnapshotNotes title="Album notes" notes={revision.album_notes} /></div>
  </main>;
}
