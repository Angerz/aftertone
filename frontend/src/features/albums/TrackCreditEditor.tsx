import { useId, useState } from "react";
import type { Artist } from "../../api/types";
import { ArtistSearchPicker } from "../artists/ArtistSearchPicker";

export function TrackCreditEditor({ title, savedTitle, number, primary, featured, onChange }: {
  title: string; savedTitle: string; number: number; primary: Artist[]; featured: Artist[];
  onChange: (kind: "primary" | "featured", artists: Artist[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<{ primary: string | null; featured: string | null }>({ primary: null, featured: null });
  const id = useId();
  const summary = [primary.length ? primary.map((artist) => artist.name).join(", ") : "Inherits album artists", featured.length ? `Featuring ${featured.map((artist) => artist.name).join(", ")}` : ""].filter(Boolean).join(" · ");
  const reportError = (kind: "primary" | "featured", message: string | null) => {
    setErrors((current) => ({ ...current, [kind]: message }));
    if (message) setOpen(true);
  };
  return <div className={`track-credit-editor${open ? " expanded" : ""}`}>
    <strong className="track-credit-desktop-title">{savedTitle}</strong>
    <button type="button" className="track-credit-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((current) => !current)}>
      <span className="track-credit-number">{String(number).padStart(2, "0")}</span>
      <span className="track-credit-copy"><strong>{title || "Untitled track"}</strong><small>{summary}</small>{!open && Object.values(errors).filter(Boolean).map((message, index) => <small key={index} role="alert">{message}</small>)}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg>
    </button>
    <div id={id} className="track-credit-fields">
      <ArtistSearchPicker label="Primary artists" selected={primary} onChange={(artists) => onChange("primary", artists)} helper="Leave empty to inherit album artists." onErrorChange={(message) => reportError("primary", message)} />
      <ArtistSearchPicker label="Featured artists" selected={featured} onChange={(artists) => onChange("featured", artists)} onErrorChange={(message) => reportError("featured", message)} />
    </div>
  </div>;
}
