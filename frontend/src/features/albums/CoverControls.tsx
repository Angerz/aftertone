import { useState } from "react";
import { deleteAlbumCover, uploadAlbumCover } from "../../api/albums";
import type { Album } from "../../api/types";

export function CoverControls({ album, onUpdated }: { album: Album; onUpdated: (album: Album) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function upload(file: File | undefined) { if (!file) return; setBusy(true); setError(null); try { onUpdated(await uploadAlbumCover(album.id, file)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function remove() { setBusy(true); setError(null); try { onUpdated(await deleteAlbumCover(album.id)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="cover-controls"><label className="cover-upload">{busy ? "Uploading cover…" : album.cover_url ? "Change cover" : "Add cover"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} /></label>{album.cover_url && <button type="button" className="text-button" onClick={remove} disabled={busy}>Remove cover</button>}{error && <p className="notice error" role="alert">{error}</p>}</div>;
}
