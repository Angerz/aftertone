import { useState } from "react";
import { deleteAlbumCover, importAlbumCoverFromUrl, uploadAlbumCover } from "../../api/albums";
import type { Album } from "../../api/types";

export function CoverControls({ album, onUpdated }: { album: Album; onUpdated: (album: Album) => void }) {
  const [busy, setBusy] = useState(false); const [url, setUrl] = useState(""); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  async function upload(file: File | undefined) { if (!file) return; setBusy(true); setError(null); setSuccess(null); try { onUpdated(await uploadAlbumCover(album.id, file)); setSuccess("Cover uploaded."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function importUrl() { if (!url.trim()) { setError("Enter an image URL."); return; } setBusy(true); setError(null); setSuccess(null); try { onUpdated(await importAlbumCoverFromUrl(album.id, url.trim())); setUrl(""); setSuccess("Cover imported and stored locally."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function remove() { setBusy(true); setError(null); setSuccess(null); try { onUpdated(await deleteAlbumCover(album.id)); setSuccess("Cover removed."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="cover-controls"><label className="cover-upload">{busy ? "Working on cover…" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} /></label><div className="cover-url"><label>Image URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/cover.jpg" disabled={busy} /></label><button type="button" onClick={importUrl} disabled={busy}>Import cover</button></div>{album.cover_url && <button type="button" className="text-button" onClick={remove} disabled={busy}>Remove cover</button>}{success && <p className="notice success" role="status">{success}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>;
}
