import { type ReactNode, useId, useState } from "react";

/** Keep children mounted so collapsing never discards a draft or search result. */
export function MobileEditDisclosure({ label, heading = false, description, chevron = false, children }: { label: string; heading?: boolean; description?: string; chevron?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = <button type="button" className="text-button mobile-edit-disclosure-toggle" aria-expanded={open} aria-controls={panelId} aria-describedby={description ? `${panelId}-description` : undefined} onClick={() => setOpen((current) => !current)}><span>{label}</span>{chevron ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg> : <span aria-hidden="true">{open ? "−" : "+"}</span>}</button>;
  return <div className="mobile-edit-disclosure">
    {heading ? <h2 className="mobile-edit-disclosure-heading"><span className="edit-desktop-heading">{label}</span>{toggle}</h2> : toggle}
    {description && <p id={`${panelId}-description`} className="mobile-edit-disclosure-description">{description}</p>}
    <div id={panelId} className={`mobile-edit-disclosure-panel${open ? " open" : ""}`}>{children}</div>
  </div>;
}
