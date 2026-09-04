import { useState } from "react";
import { clearAlbumRevisit, markAlbumForRevisit } from "../../api/albums";
import type { Album } from "../../api/types";

export function RevisitControls({ album, onUpdated }: { album: Album; onUpdated: (album: Album) => void }) {
  const [reason, setReason] = useState(album.revisit_reason ?? ""); const [busy, setBusy] = useState(false);
  async function toggle() { setBusy(true); try { onUpdated(album.needs_revisit ? await clearAlbumRevisit(album.id) : await markAlbumForRevisit(album.id, reason)); } finally { setBusy(false); } }
  return <section className="revisit-controls"><label>Revisit reason (optional)<textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why revisit this album?" /></label><button type="button" className="text-button" onClick={toggle} disabled={busy}>{album.needs_revisit ? "Clear revisit mark" : "Mark for revisit"}</button></section>;
}
