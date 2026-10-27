import { useEffect, useState } from "react";
import { getAlbum } from "../../api/albums";
import { ApiError } from "../../api/client";
import { getRevision } from "../../api/revisions";
import { RevisionDetailPage } from "./RevisionDetailPage";

const notFound = "This rating revision could not be found for this album.";

export async function loadAlbumRevision(albumId: number, revisionId: number) {
  if (![albumId, revisionId].every((id) => Number.isSafeInteger(id) && id > 0)) throw new Error(notFound);
  const [album, revision] = await Promise.all([getAlbum(albumId), getRevision(albumId, revisionId)]);
  if (album.id !== albumId || revision.id !== revisionId || revision.album_id !== albumId) throw new Error(notFound);
  return { album, revision };
}

export function AlbumRevisionPage({ albumId, revisionId, onBack }: { albumId: number; revisionId: number; onBack: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAlbumRevision>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    loadAlbumRevision(albumId, revisionId).then((result) => {
      if (active) setData(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError && cause.status === 404 ? notFound : cause instanceof Error ? cause.message : "This revision could not be loaded.");
    });
    return () => { active = false; };
  }, [albumId, revisionId]);

  if (data) return <RevisionDetailPage album={data.album} revision={data.revision} onBack={onBack} backLabel="← Back to album" className="album-revision-detail" />;
  return <main className="page editor revision-detail album-revision-detail">
    <button className="back" onClick={onBack}>← Back to album</button>
    {error ? <p className="notice error" role="alert">{error}</p> : <p role="status">Loading revision…</p>}
  </main>;
}
