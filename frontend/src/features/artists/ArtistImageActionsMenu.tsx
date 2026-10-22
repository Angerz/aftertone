import { useEffect, useId, useRef, useState } from "react";

export function ArtistImageActionsMenu({ disabled, onRemove, focusUpload }: { disabled: boolean; onRemove: () => Promise<void>; focusUpload: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const item = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    item.current?.focus();
    const outside = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  async function remove() {
    setOpen(false); trigger.current?.focus();
    await onRemove();
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        if (trigger.current && !trigger.current.disabled) trigger.current.focus();
        else focusUpload();
      }
    });
  }
  return <span ref={root} className="artist-image-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="icon-button artist-image-menu-trigger" aria-label="Artist image actions" aria-haspopup="menu" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); } }}>…</button>
    {open && <div id={id} role="menu" aria-label="Artist image actions" className="artist-image-menu-panel" onKeyDown={(event) => { if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); item.current?.focus(); } }}><button ref={item} type="button" role="menuitem" onClick={() => { void remove(); }}>Remove image</button></div>}
  </span>;
}
