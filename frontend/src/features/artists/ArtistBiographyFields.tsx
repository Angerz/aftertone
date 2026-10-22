import { useId, type ReactNode } from "react";

/** Mobile disclosure only; desktop children retain their existing grid layout. */
export function ArtistBiographyFields({ open, onToggle, summary, children }: { open: boolean; onToggle: () => void; summary: string; children: ReactNode }) {
  const id = useId();
  return <div className={`artist-biography${open ? " expanded" : ""}`}>
    <button type="button" className="text-button artist-biography-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>Biographical details<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg></button>
    {!open && <p className="artist-biography-summary">{summary || "Optional dates and history"}</p>}
    <div id={id} className="artist-biography-fields">{children}</div>
  </div>;
}
