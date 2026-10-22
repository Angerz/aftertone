import { useId, type ReactNode } from "react";
import type { ReleaseType } from "../../api/types";

export function AlbumMetadataSection({ open, onToggle, title, artists, year, releaseType, discCount, error, errorId, children }: {
  open: boolean; onToggle: () => void; title: string; artists: string[]; year: string; releaseType: ReleaseType; discCount: number;
  error: string | null; errorId: string; children: ReactNode;
}) {
  const panelId = useId();
  return <section className={`album-metadata-section${open ? " expanded" : ""}`}>
    <h2 className="album-metadata-heading"><button type="button" className="text-button album-metadata-toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>Album metadata<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg></button></h2>
    {!open && <div className="album-metadata-summary">
      <strong>{title.trim() || "Untitled album"}</strong>
      <span>{artists.map((artist) => artist.trim()).filter(Boolean).join(" & ") || "Artist not set"}</span>
      <small>{year || "Year unknown"} · <span className="album-metadata-type">{releaseType}</span> · {discCount} disc{discCount === 1 ? "" : "s"}</small>
    </div>}
    {error && <p id={errorId} className="notice error album-metadata-error" role="alert">{error}</p>}
    <div id={panelId} className="album-metadata-fields">{children}</div>
  </section>;
}
