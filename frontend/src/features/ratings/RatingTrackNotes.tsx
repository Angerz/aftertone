import { useCallback, useLayoutEffect, useRef, useState } from "react";

function resizeNotes(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

/** Disclosure state is presentation only; the parent draft always owns the text. */
export function RatingTrackNotes({ trackId, title, value, onChange }: {
  trackId: number; title: string; value: string; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const attachTextarea = useCallback((node: HTMLTextAreaElement | null) => {
    textarea.current = node;
    resizeNotes(node);
  }, []);
  useLayoutEffect(() => {
    if (open && window.matchMedia("(max-width: 800px)").matches) resizeNotes(textarea.current);
  }, [open, value]);
  const panelId = `rating-track-note-${trackId}`;
  const action = open ? "Close note" : value.trim() ? "Edit note" : "Add note";
  return <div className="rating-note-disclosure">
    <button ref={trigger} type="button" className="text-button rating-note-toggle" aria-expanded={open}
      aria-controls={panelId} aria-label={`${action} for ${title}`} onClick={() => setOpen(!open)}>
      {action}{value.trim() && <span className="rating-note-indicator" aria-hidden="true"> · added</span>}
    </button>
    <div id={panelId} className={`rating-note-panel${open ? " open" : ""}`} onKeyDown={(event) => {
      if (event.key === "Escape" && open && window.matchMedia("(max-width: 800px)").matches) {
        event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true });
      }
    }}>
      <label className="rating-track-notes">Notes<textarea ref={attachTextarea} rows={2} aria-label={`Notes for ${title}`} value={value}
        onInput={(event) => resizeNotes(event.currentTarget)} onChange={(event) => onChange(event.target.value)} placeholder="What stands out?" /></label>
    </div>
  </div>;
}
