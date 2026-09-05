import { useEffect, useState } from "react";
import { AlbumsPage } from "./features/albums/AlbumsPage";
import { CreateAlbumPage } from "./features/albums/CreateAlbumPage";
import { RatingEditorPage } from "./features/ratings/RatingEditorPage";
import { LegacyImportPage } from "./features/imports/LegacyImportPage";
import { LegacyReconciliationPage } from "./features/ratings/LegacyReconciliationPage";
import { AlbumPage } from "./features/albums/AlbumPage";

type View = { name: "albums" } | { name: "create" } | { name: "import" } | { name: "album"; albumId: number } | { name: "rate"; albumId: number } | { name: "reconcile"; albumId: number };
function readView(): View { const reconcile = window.location.pathname.match(/^\/albums\/(\d+)\/reconcile$/); const rate = window.location.pathname.match(/^\/albums\/(\d+)\/rate$/); const album = window.location.pathname.match(/^\/albums\/(\d+)$/); return reconcile ? { name: "reconcile", albumId: Number(reconcile[1]) } : rate ? { name: "rate", albumId: Number(rate[1]) } : album ? { name: "album", albumId: Number(album[1]) } : window.location.pathname === "/albums/new" ? { name: "create" } : window.location.pathname === "/import" ? { name: "import" } : { name: "albums" }; }
export function App() { const [view, setView] = useState(readView); const navigate = (next: View) => { const path = next.name === "albums" ? "/" : next.name === "create" ? "/albums/new" : next.name === "import" ? "/import" : next.name === "album" ? `/albums/${next.albumId}` : next.name === "reconcile" ? `/albums/${next.albumId}/reconcile` : `/albums/${next.albumId}/rate`; window.history.pushState({}, "", path); setView(next); };
  useEffect(() => { const onPopState = () => setView(readView()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  if (view.name === "create") return <CreateAlbumPage onCancel={() => navigate({ name: "albums" })} onCreated={(albumId) => navigate({ name: "album", albumId })} />;
  if (view.name === "import") return <LegacyImportPage onBack={() => navigate({ name: "albums" })} />;
  if (view.name === "reconcile") return <LegacyReconciliationPage albumId={view.albumId} onBack={() => navigate({ name: "album", albumId: view.albumId })} />;
  if (view.name === "rate") return <RatingEditorPage albumId={view.albumId} onBack={() => navigate({ name: "album", albumId: view.albumId })} onReconcile={() => navigate({ name: "reconcile", albumId: view.albumId })} />;
  if (view.name === "album") return <AlbumPage albumId={view.albumId} onBack={() => navigate({ name: "albums" })} onRate={() => navigate({ name: "rate", albumId: view.albumId })} onReconcile={() => navigate({ name: "reconcile", albumId: view.albumId })} />;
  return <AlbumsPage onCreate={() => navigate({ name: "create" })} onImport={() => navigate({ name: "import" })} onOpen={(albumId) => navigate({ name: "album", albumId })} />;
}
