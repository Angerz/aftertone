import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { deleteArtistImage, importArtistImageFromUrl, uploadArtistImage } from "../../api/artists";
import type { Artist } from "../../api/types";
import { ArtistImageActionsMenu } from "./ArtistImageActionsMenu";

export function ArtistImageControls({ artist, onUpdated, compactMobile = false }: { artist: Artist; onUpdated: (artist: Artist) => void; compactMobile?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const restoreMobileFocus = useRef(false);

  function closeUrlPopover({ clear = true, returnFocus = true } = {}) {
    setShowUrl(false);
    if (clear) { setUrl(""); setUrlError(null); }
    if (returnFocus) {
      if (compactMobile) restoreMobileFocus.current = true;
      else window.setTimeout(() => triggerRef.current?.focus());
    }
  }

  useLayoutEffect(() => {
    if (!restoreMobileFocus.current || showUrl || busy) return;
    restoreMobileFocus.current = false;
    if (document.activeElement === document.body || popoverRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
  }, [showUrl, busy]);

  useEffect(() => {
    if (!showUrl) return;
    if (compactMobile) return;
    urlInputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) { if (!busy && event.key === "Escape") closeUrlPopover(); }
    function handlePointerDown(event: MouseEvent) {
      if (!busy && !popoverRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) closeUrlPopover();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); document.removeEventListener("mousedown", handlePointerDown); };
  }, [busy, showUrl, compactMobile]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setActionError(null);
    try { onUpdated(await uploadArtistImage(artist.id, file)); }
    catch (cause) { setActionError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(compactMobile ? "Remove artist image? This updates the image immediately, independently of Save changes." : "Remove artist image?")) return;
    setBusy(true); setActionError(null);
    try { onUpdated(await deleteArtistImage(artist.id)); }
    catch (cause) { setActionError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function importUrl() {
    if (!url.trim()) { setUrlError("Enter an image URL."); return; }
    setBusy(true); setUrlError(null);
    try { onUpdated(await importArtistImageFromUrl(artist.id, url.trim())); closeUrlPopover({ returnFocus: !compactMobile || document.activeElement === document.body || Boolean(popoverRef.current?.contains(document.activeElement)) }); }
    catch (cause) { setUrlError((cause as Error).message || "Could not import image. Check the URL and try again."); }
    finally { setBusy(false); }
  }

  return <div className={`artist-image-controls${compactMobile ? " artist-image-controls-mobile" : ""}`}><div className="artist-image-actions">{compactMobile && <ArtistImageActionsMenu disabled={busy || !artist.image_url} onRemove={remove} focusUpload={() => uploadInputRef.current?.focus()} />}<label className="cover-upload">{busy ? "Working on image…" : artist.image_url ? "Change image" : "Upload image"}<input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} /></label><span className="artist-url-import"><button ref={triggerRef} type="button" className="text-button" aria-expanded={showUrl} aria-controls="artist-image-url-popover" onClick={() => showUrl ? closeUrlPopover({ clear: !compactMobile, returnFocus: false }) : setShowUrl(true)} disabled={busy}>Import from URL{compactMobile && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={showUrl ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} /></svg>}</button>{(showUrl || compactMobile) && <div ref={popoverRef} id="artist-image-url-popover" className={`artist-image-url${showUrl ? " open" : ""}`} hidden={!showUrl} role={compactMobile ? undefined : "dialog"} aria-label={compactMobile ? undefined : "Import artist image from URL"}><label>Image URL<input ref={urlInputRef} type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/image.jpg" disabled={busy} /></label>{urlError && <p className="notice error" role="alert">{urlError}</p>}<div><button type="button" onClick={importUrl} disabled={busy}>{busy ? "Importing…" : "Import image"}</button><button type="button" className="text-button" onClick={() => closeUrlPopover()} disabled={busy}>Cancel</button></div></div>}</span>{!compactMobile && artist.image_url && <button type="button" className="text-button" onClick={remove} disabled={busy}>Remove</button>}</div>{actionError && <p className="notice error" role="alert">{actionError}</p>}</div>;
}
