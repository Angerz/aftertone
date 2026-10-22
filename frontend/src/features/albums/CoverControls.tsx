import { useRef, useState } from "react";
import { deleteAlbumCover, importAlbumCoverFromUrl, uploadAlbumCover } from "../../api/albums";
import type { Album } from "../../api/types";
import { MobileEditDisclosure } from "./MobileEditDisclosure";
import { CoverActionsMenu } from "./CoverActionsMenu";

export function CoverControls({ album, onUpdated, compactMobile = false }: { album: Album; onUpdated: (album: Album) => void; compactMobile?: boolean }) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [url, setUrl] = useState(""); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  async function upload(file: File | undefined) { if (!file) return; setBusy(true); setError(null); setSuccess(null); try { onUpdated(await uploadAlbumCover(album.id, file)); setSuccess("Cover uploaded."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function importUrl() { if (!url.trim()) { setError("Enter an image URL."); return; } setBusy(true); setError(null); setSuccess(null); try { onUpdated(await importAlbumCoverFromUrl(album.id, url.trim())); setUrl(""); setSuccess("Cover imported and stored locally."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function remove() { if (compactMobile && !window.confirm("Remove the existing cover? This updates the cover immediately, independently of Save changes.")) return; setBusy(true); setError(null); setSuccess(null); try { onUpdated(await deleteAlbumCover(album.id)); setSuccess("Cover removed."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const urlControls = <div className="cover-url"><label>Image URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/cover.jpg" disabled={busy} /></label><button type="button" onClick={importUrl} disabled={busy}>Import cover</button></div>;
  return <div className="cover-controls">{compactMobile && <CoverActionsMenu disabled={busy || !album.cover_url} onRemove={remove} focusUpload={() => uploadInput.current?.focus()} />}<label className="cover-upload">{busy ? "Working on cover…" : "Upload image"}<input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} /></label>{compactMobile ? <MobileEditDisclosure label="Import from URL" chevron>{urlControls}</MobileEditDisclosure> : urlControls}{album.cover_url && <button type="button" className={`text-button${compactMobile ? " cover-remove-desktop" : ""}`} onClick={remove} disabled={busy}>Remove cover</button>}{success && <p className="notice success" role="status">{success}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>;
}
