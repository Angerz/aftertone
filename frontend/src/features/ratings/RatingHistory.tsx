import type { RatingRevisionSummary } from "../../api/types";

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const rating = (value: number | null) => value === null ? "—" : value.toFixed(3);

export function formatRevisionDate(value: string) { return dateFormatter.format(new Date(value)); }

export function RatingHistory({ revisions, onSelect }: { revisions: RatingRevisionSummary[]; onSelect: (revisionId: number) => void }) {
  const ordered = [...revisions].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime() || right.id - left.id);
  return <section className="rating-history" aria-labelledby="rating-history-heading">
    <h2 id="rating-history-heading">Rating history</h2>
    {!ordered.length ? <p className="history-empty">No ratings yet.</p> : <ol>{ordered.map((revision) => <li key={revision.id}><button className="history-entry" onClick={() => onSelect(revision.id)}><span><strong>{formatRevisionDate(revision.created_at)}</strong><small>PRE {rating(revision.pre_rating)} · Coherence {revision.coherence.toFixed(1)} · Emotion {revision.emotion.toFixed(1)}</small></span><b>{rating(revision.final_rating)}</b></button></li>)}</ol>}
  </section>;
}
