import { useEffect, useState } from "react";
import { AlbumsPage } from "./features/albums/AlbumsPage";
import { CreateAlbumPage } from "./features/albums/CreateAlbumPage";
import { RatingEditorPage } from "./features/ratings/RatingEditorPage";
import { LegacyImportPage } from "./features/imports/LegacyImportPage";

type View = { name: "albums" } | { name: "create" } | { name: "import" } | { name: "rate"; albumId: number };
function readView(): View { const match = window.location.pathname.match(/^\/albums\/(\d+)$/); return match ? { name: "rate", albumId: Number(match[1]) } : window.location.pathname === "/albums/new" ? { name: "create" } : window.location.pathname === "/import" ? { name: "import" } : { name: "albums" }; }
export function App() { const [view, setView] = useState(readView); const navigate = (next: View) => { const path = next.name === "albums" ? "/" : next.name === "create" ? "/albums/new" : next.name === "import" ? "/import" : `/albums/${next.albumId}`; window.history.pushState({}, "", path); setView(next); };
  useEffect(() => { const onPopState = () => setView(readView()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  if (view.name === "create") return <CreateAlbumPage onCancel={() => navigate({ name: "albums" })} onCreated={(albumId) => navigate({ name: "rate", albumId })} />;
  if (view.name === "import") return <LegacyImportPage onBack={() => navigate({ name: "albums" })} />;
  if (view.name === "rate") return <RatingEditorPage albumId={view.albumId} onBack={() => navigate({ name: "albums" })} />;
  return <AlbumsPage onCreate={() => navigate({ name: "create" })} onImport={() => navigate({ name: "import" })} onOpen={(albumId) => navigate({ name: "rate", albumId })} />;
}
