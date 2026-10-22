import { useEffect, useId, useRef, useState } from "react";

export function CoverActionsMenu({ disabled, onRemove, focusUpload }: { disabled: boolean; onRemove: () => Promise<void>; focusUpload: () => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const item = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    item.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    const outside = (event: globalThis.PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const viewport = window.matchMedia("(max-width: 700px)");
    const resize = () => { if (!viewport.matches) setOpen(false); };
    viewport.addEventListener("change", resize);
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { viewport.removeEventListener("change", resize); document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  async function remove() {
    setOpen(false);
    trigger.current?.focus();
    await onRemove();
    // Restore focus after a busy control becomes unavailable, without taking it
    // from a user who has already moved elsewhere during the request.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        if (trigger.current && !trigger.current.disabled) trigger.current.focus();
        else focusUpload();
      }
    });
  }
  return <span className="edit-cover-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={trigger} type="button" className="icon-button edit-cover-menu-trigger" aria-label="Cover art actions" aria-haspopup="menu" aria-controls={id} aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); } }}>…</button>
    {open && <div ref={menu} id={id} role="menu" aria-label="Cover art actions" className="edit-cover-menu-panel" onKeyDown={(event) => { if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); item.current?.focus(); } }}>
      <button ref={item} type="button" role="menuitem" disabled={disabled} onClick={() => { void remove(); }}>Remove cover</button>
    </div>}
  </span>;
}
