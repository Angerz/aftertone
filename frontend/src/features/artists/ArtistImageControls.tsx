import { useEffect, useRef, useState } from "react";
import { deleteArtistImage, importArtistImageFromUrl, uploadArtistImage } from "../../api/artists";
import type { Artist } from "../../api/types";

export function ArtistImageControls({ artist, onUpdated }: { artist: Artist; onUpdated: (artist: Artist) => void }) {
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  function closeUrlPopover({ clear = true, returnFocus = true } = {}) {
    setShowUrl(false);
    if (clear) { setUrl(""); setUrlError(null); }
    if (returnFocus) window.setTimeout(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!showUrl) return;
    urlInputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) { if (!busy && event.key === "Escape") closeUrlPopover(); }
    function handlePointerDown(event: MouseEvent) {
      if (!busy && !popoverRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) closeUrlPopover();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); document.removeEventListener("mousedown", handlePointerDown); };
  }, [busy, showUrl]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setActionError(null);
    try { onUpdated(await uploadArtistImage(artist.id, file)); }
    catch (cause) { setActionError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm("Remove artist image?")) return;
    setBusy(true); setActionError(null);
    try { onUpdated(await deleteArtistImage(artist.id)); }
    catch (cause) { setActionError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function importUrl() {
    if (!url.trim()) { setUrlError("Enter an image URL."); return; }
    setBusy(true); setUrlError(null);
    try { onUpdated(await importArtistImageFromUrl(artist.id, url.trim())); closeUrlPopover(); }
    catch (cause) { setUrlError((cause as Error).message || "Could not import image. Check the URL and try again."); }
    finally { setBusy(false); }
  }

  return <div className="artist-image-controls"><div className="artist-image-actions"><label className="cover-upload">{busy ? "Working on image…" : artist.image_url ? "Change image" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} /></label><span className="artist-url-import"><button ref={triggerRef} type="button" className="text-button" aria-expanded={showUrl} aria-controls="artist-image-url-popover" onClick={() => showUrl ? closeUrlPopover({ returnFocus: false }) : setShowUrl(true)} disabled={busy}>Import from URL</button>{showUrl && <div ref={popoverRef} id="artist-image-url-popover" className="artist-image-url" role="dialog" aria-label="Import artist image from URL"><label>Image URL<input ref={urlInputRef} type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/image.jpg" disabled={busy} /></label>{urlError && <p className="notice error" role="alert">{urlError}</p>}<div><button type="button" onClick={importUrl} disabled={busy}>{busy ? "Importing…" : "Import image"}</button><button type="button" className="text-button" onClick={() => closeUrlPopover()} disabled={busy}>Cancel</button></div></div>}</span>{artist.image_url && <button type="button" className="text-button" onClick={remove} disabled={busy}>Remove</button>}</div>{actionError && <p className="notice error" role="alert">{actionError}</p>}</div>;
}
