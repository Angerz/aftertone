import { useEffect, useState } from "react";
import { AlbumsPage } from "./features/albums/AlbumsPage";
import { CreateAlbumPage } from "./features/albums/CreateAlbumPage";
import { RatingEditorPage } from "./features/ratings/RatingEditorPage";
import { LegacyImportPage } from "./features/imports/LegacyImportPage";
import { LegacyReconciliationPage } from "./features/ratings/LegacyReconciliationPage";

type View = { name: "albums" } | { name: "create" } | { name: "import" } | { name: "rate"; albumId: number } | { name: "reconcile"; albumId: number };
function readView(): View { const reconcile = window.location.pathname.match(/^\/albums\/(\d+)\/reconcile$/); const match = window.location.pathname.match(/^\/albums\/(\d+)$/); return reconcile ? { name: "reconcile", albumId: Number(reconcile[1]) } : match ? { name: "rate", albumId: Number(match[1]) } : window.location.pathname === "/albums/new" ? { name: "create" } : window.location.pathname === "/import" ? { name: "import" } : { name: "albums" }; }
export function App() { const [view, setView] = useState(readView); const navigate = (next: View) => { const path = next.name === "albums" ? "/" : next.name === "create" ? "/albums/new" : next.name === "import" ? "/import" : next.name === "reconcile" ? `/albums/${next.albumId}/reconcile` : `/albums/${next.albumId}`; window.history.pushState({}, "", path); setView(next); };
  useEffect(() => { const onPopState = () => setView(readView()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  if (view.name === "create") return <CreateAlbumPage onCancel={() => navigate({ name: "albums" })} onCreated={(albumId) => navigate({ name: "rate", albumId })} />;
  if (view.name === "import") return <LegacyImportPage onBack={() => navigate({ name: "albums" })} />;
  if (view.name === "reconcile") return <LegacyReconciliationPage albumId={view.albumId} onBack={() => navigate({ name: "rate", albumId: view.albumId })} />;
  if (view.name === "rate") return <RatingEditorPage albumId={view.albumId} onBack={() => navigate({ name: "albums" })} onReconcile={() => navigate({ name: "reconcile", albumId: view.albumId })} />;
  return <AlbumsPage onCreate={() => navigate({ name: "create" })} onImport={() => navigate({ name: "import" })} onOpen={(albumId) => navigate({ name: "rate", albumId })} />;
}
