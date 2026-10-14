import { useEffect, useState } from "react";
import { AlbumsPage } from "./features/albums/AlbumsPage";
import { CreateAlbumPage } from "./features/albums/CreateAlbumPage";
import { RatingEditorPage } from "./features/ratings/RatingEditorPage";
import { LegacyImportPage } from "./features/imports/LegacyImportPage";
import { LegacyReconciliationPage } from "./features/ratings/LegacyReconciliationPage";
import { AlbumPage } from "./features/albums/AlbumPage";
import { EditAlbumPage } from "./features/albums/EditAlbumPage";
import { ArtistPage, ArtistsPage } from "./features/artists/ArtistPage";
import { ArtistTracksPage } from "./features/artists/ArtistTracksPage";
import { EditArtistPage } from "./features/artists/EditArtistPage";
import { FavoriteSongsPage } from "./features/favorites/FavoriteSongsPage";
import { hasArtistDetailTabBack, hasInternalBack, initialAftertoneState, nextAftertoneState, notifyNavigationChange } from "./navigation";

import { useOwner, useOwnerSignIn } from "./features/auth/Auth";
import { EntryScreen } from "./features/auth/EntryScreen";
import { legacyLibraryQuery, readRoute, requiresOwner, routePath, type View } from "./appRoutes";

function readView(): View { return readRoute(window.location.pathname, window.location.search); }
export function App() { const owner = useOwner(); const openSignIn = useOwnerSignIn(); const [view, setView] = useState(readView); const navigate = (next: View, replace = false) => { window.history[replace ? "replaceState" : "pushState"](replace ? initialAftertoneState(window.history.state) : nextAftertoneState(window.history.state), "", routePath(next)); setView(next); notifyNavigationChange(); };
  const contextualBack = (fallback: View) => { if (hasInternalBack(window.history.state)) window.history.back(); else navigate(fallback, true); };
  const artistDetailBack = (fallback: View) => { if (hasArtistDetailTabBack(window.history.state)) window.history.back(); else contextualBack(fallback); };
  useEffect(() => { const path = window.location.pathname === "/albums" || (window.location.pathname === "/" && legacyLibraryQuery(window.location.search)) ? "/library" : window.location.pathname; window.history.replaceState(initialAftertoneState(window.history.state), "", `${path}${window.location.search}`); const onPopState = () => setView(readView()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  useEffect(() => { if (!owner && requiresOwner(view)) { navigate({ name: "albums" }, true); openSignIn(); } }, [owner, view.name, openSignIn]);
  if (!owner && requiresOwner(view)) return null;
  if (view.name === "landing") return <EntryScreen owner={owner} onExplore={() => navigate({ name: "albums" })} onSignIn={openSignIn} />;
  if (view.name === "create") return <CreateAlbumPage onCancel={() => navigate({ name: "albums" })} onCreated={(albumId) => navigate({ name: "album", albumId })} />;
  if (view.name === "import") return <LegacyImportPage onBack={() => navigate({ name: "albums" })} />;
  if (view.name === "artists") return <ArtistsPage onOpen={(artistId) => navigate({ name: "artist", artistId })} />;
  if (view.name === "top-songs") return <FavoriteSongsPage />;
  if (view.name === "artist") return <ArtistPage artistId={view.artistId} onBack={() => artistDetailBack({ name: "artists" })} onAlbum={(albumId) => navigate({ name: "album", albumId })} onEdit={() => navigate({ name: "artist-edit", artistId: view.artistId }, true)} onTracks={() => navigate({ name: "artist-tracks", artistId: view.artistId })} />;
  if (view.name === "artist-tracks") return <ArtistTracksPage artistId={view.artistId} onBack={() => contextualBack({ name: "artist", artistId: view.artistId })} onAlbum={(albumId) => navigate({ name: "album", albumId })} />;
  if (view.name === "artist-edit") return <EditArtistPage artistId={view.artistId} onCancel={() => navigate({ name: "artist", artistId: view.artistId }, true)} onSaved={() => navigate({ name: "artist", artistId: view.artistId }, true)} />;
  if (view.name === "reconcile") return <LegacyReconciliationPage albumId={view.albumId} onBack={() => navigate({ name: "album", albumId: view.albumId }, true)} onReconciled={() => navigate({ name: "album", albumId: view.albumId }, true)} />;
  if (view.name === "edit") return <EditAlbumPage albumId={view.albumId} onCancel={() => navigate({ name: "album", albumId: view.albumId }, true)} onSaved={() => navigate({ name: "album", albumId: view.albumId }, true)} />;
  if (view.name === "rate") return <RatingEditorPage albumId={view.albumId} onBack={() => navigate({ name: "album", albumId: view.albumId }, true)} onReconcile={() => navigate({ name: "reconcile", albumId: view.albumId }, true)} onSaved={() => navigate({ name: "album", albumId: view.albumId }, true)} />;
  if (view.name === "album") return <AlbumPage albumId={view.albumId} onBack={() => contextualBack({ name: "albums" })} onRate={() => navigate({ name: "rate", albumId: view.albumId }, true)} onReconcile={() => navigate({ name: "reconcile", albumId: view.albumId }, true)} onEdit={() => navigate({ name: "edit", albumId: view.albumId }, true)} onArtist={(artistId) => navigate({ name: "artist", artistId })} onYear={(year) => { window.history.pushState(nextAftertoneState(window.history.state), "", `/library?decade=${Math.floor(year / 10) * 10}&year=${year}`); setView({ name: "albums" }); notifyNavigationChange(); }} onMonth={(year, month) => { window.history.pushState(nextAftertoneState(window.history.state), "", `/library?decade=${Math.floor(year / 10) * 10}&year=${year}&month=${month}`); setView({ name: "albums" }); notifyNavigationChange(); }} />;
  return <AlbumsPage onCreate={() => navigate({ name: "create" })} onOpen={(albumId) => navigate({ name: "album", albumId })} />;
}
