import { useEffect, useState } from "react";
import { AlbumsPage } from "./features/albums/AlbumsPage";
import { CreateAlbumPage } from "./features/albums/CreateAlbumPage";
import { RatingEditorPage } from "./features/ratings/RatingEditorPage";
import { LegacyImportPage } from "./features/imports/LegacyImportPage";
import { LegacyReconciliationPage } from "./features/ratings/LegacyReconciliationPage";
import { AlbumPage } from "./features/albums/AlbumPage";
import { EditAlbumPage } from "./features/albums/EditAlbumPage";
import { ArtistPage, ArtistsPage } from "./features/artists/ArtistPage";

type View = { name: "albums" } | { name: "artists" } | { name: "artist"; artistId: number } | { name: "create" } | { name: "import" } | { name: "album"; albumId: number } | { name: "edit"; albumId: number } | { name: "rate"; albumId: number } | { name: "reconcile"; albumId: number };
function readView(): View { const artist = window.location.pathname.match(/^\/artists\/(\d+)$/); const reconcile = window.location.pathname.match(/^\/albums\/(\d+)\/reconcile$/); const edit = window.location.pathname.match(/^\/albums\/(\d+)\/edit$/); const rate = window.location.pathname.match(/^\/albums\/(\d+)\/rate$/); const album = window.location.pathname.match(/^\/albums\/(\d+)$/); return artist ? { name: "artist", artistId: Number(artist[1]) } : reconcile ? { name: "reconcile", albumId: Number(reconcile[1]) } : edit ? { name: "edit", albumId: Number(edit[1]) } : rate ? { name: "rate", albumId: Number(rate[1]) } : album ? { name: "album", albumId: Number(album[1]) } : window.location.pathname === "/artists" ? { name: "artists" } : window.location.pathname === "/albums/new" ? { name: "create" } : window.location.pathname === "/import" ? { name: "import" } : { name: "albums" }; }
export function App() { const [view, setView] = useState(readView); const navigate = (next: View) => { const path = next.name === "albums" ? "/" : next.name === "artists" ? "/artists" : next.name === "artist" ? `/artists/${next.artistId}` : next.name === "create" ? "/albums/new" : next.name === "import" ? "/import" : next.name === "album" ? `/albums/${next.albumId}` : next.name === "edit" ? `/albums/${next.albumId}/edit` : next.name === "reconcile" ? `/albums/${next.albumId}/reconcile` : `/albums/${next.albumId}/rate`; window.history.pushState({}, "", path); setView(next); };
  useEffect(() => { const onPopState = () => setView(readView()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  if (view.name === "create") return <CreateAlbumPage onCancel={() => navigate({ name: "albums" })} onCreated={(albumId) => navigate({ name: "album", albumId })} />;
  if (view.name === "import") return <LegacyImportPage onBack={() => navigate({ name: "albums" })} />;
  if (view.name === "artists") return <ArtistsPage onBack={() => navigate({ name: "albums" })} onOpen={(artistId) => navigate({ name: "artist", artistId })} />;
  if (view.name === "artist") return <ArtistPage artistId={view.artistId} onBack={() => navigate({ name: "artists" })} onAlbum={(albumId) => navigate({ name: "album", albumId })} />;
  if (view.name === "reconcile") return <LegacyReconciliationPage albumId={view.albumId} onBack={() => navigate({ name: "album", albumId: view.albumId })} />;
  if (view.name === "edit") return <EditAlbumPage albumId={view.albumId} onCancel={() => navigate({ name: "album", albumId: view.albumId })} onSaved={() => navigate({ name: "album", albumId: view.albumId })} />;
  if (view.name === "rate") return <RatingEditorPage albumId={view.albumId} onBack={() => navigate({ name: "album", albumId: view.albumId })} onReconcile={() => navigate({ name: "reconcile", albumId: view.albumId })} />;
  if (view.name === "album") return <AlbumPage albumId={view.albumId} onBack={() => navigate({ name: "albums" })} onRate={() => navigate({ name: "rate", albumId: view.albumId })} onReconcile={() => navigate({ name: "reconcile", albumId: view.albumId })} onEdit={() => navigate({ name: "edit", albumId: view.albumId })} onArtist={(artistId) => navigate({ name: "artist", artistId })} />;
  return <AlbumsPage onCreate={() => navigate({ name: "create" })} onImport={() => navigate({ name: "import" })} onArtists={() => navigate({ name: "artists" })} onOpen={(albumId) => navigate({ name: "album", albumId })} />;
}
