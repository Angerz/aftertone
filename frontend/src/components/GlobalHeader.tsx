import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { activeSection, readRoute } from "../appRoutes";
import { allowPageNavigation, navigationChangeEvent } from "../navigation";

const links = [
  { label: "Library", path: "/library", section: "library" },
  { label: "Artists", path: "/artists", section: "artists" },
  { label: "Top 100", path: "/top-songs", section: "favorites" },
] as const;

export function GlobalHeader({ onNavigate, children }: { onNavigate: (path: string) => void; children: ReactNode }) {
  const readLocation = () => ({ path: window.location.pathname, search: window.location.search });
  const [location, setLocation] = useState(readLocation);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const minimal = location.path === "/" && readRoute(location.path, location.search).name === "landing";
  const section = activeSection(readRoute(location.path, location.search));

  useEffect(() => {
    const restore = () => { setLocation(readLocation()); setOpen(false); };
    window.addEventListener("popstate", restore);
    window.addEventListener(navigationChangeEvent, restore);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener(navigationChangeEvent, restore); };
  }, []);
  useEffect(() => {
    if (!open) return;
    navigationRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const close = () => { setOpen(false); triggerRef.current?.focus(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    const outside = (event: PointerEvent) => { if (!navigationRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false); };
    const focus = (event: FocusEvent) => { if (!navigationRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", outside); document.addEventListener("focusin", focus);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", focus); };
  }, [open]);

  function follow(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (path !== window.location.pathname && !allowPageNavigation()) return;
    setOpen(false);
    if (path !== window.location.pathname) onNavigate(path);
    triggerRef.current?.focus();
  }

  return <header className={`owner-access${minimal ? " owner-access-minimal" : ""}`}>
    <a className="owner-access-brand" href="/" onClick={(event) => follow(event, "/")}>Aftertone</a>
    <div className="global-header-actions">
      {!minimal && <>
        <button ref={triggerRef} type="button" className="text-button global-nav-toggle" aria-expanded={open} aria-controls="global-navigation" onClick={() => setOpen((value) => !value)}>Menu</button>
        <nav ref={navigationRef} id="global-navigation" className={`global-navigation${open ? " open" : ""}`} aria-label="Main navigation">
          {links.map((link) => <a key={link.path} href={link.path} className={section === link.section ? "active" : ""} aria-current={section === link.section ? "page" : undefined} onClick={(event) => follow(event, link.path)}>{link.label}</a>)}
        </nav>
      </>}
      <div className="global-header-auth">{children}</div>
    </div>
  </header>;
}
