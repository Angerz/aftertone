import { routePath } from "../../appRoutes";
import { hasAlbumRevisionBack, initialAftertoneState, nextAftertoneState } from "../../navigation";

interface RevisionNavigationTarget {
  location: Pick<Location, "pathname">;
  history: Pick<History, "state" | "pushState" | "replaceState" | "back">;
}

/** Returns false for an already-open revision, without adding another entry. */
export function openAlbumRevision(albumId: number, revisionId: number, target: RevisionNavigationTarget = window): boolean {
  const path = routePath({ name: "revision", albumId, revisionId });
  if (target.location.pathname === path) return false;
  const albumPath = routePath({ name: "album", albumId });
  const editorPath = routePath({ name: "rate", albumId });
  const fromAlbum = target.location.pathname === albumPath || target.location.pathname === editorPath;
  // The editor flushes its draft first. Keep it out of the album/snapshot back path.
  if (target.location.pathname === editorPath) target.history.replaceState(initialAftertoneState(target.history.state), "", albumPath);
  target.history.pushState({ ...nextAftertoneState(target.history.state), ...(fromAlbum ? { albumRevisionOrigin: albumId } : {}) }, "", path);
  return true;
}

export function returnToRevisionAlbum(albumId: number, target: RevisionNavigationTarget = window): "back" | "replace" {
  if (hasAlbumRevisionBack(target.history.state, albumId)) {
    target.history.back();
    return "back";
  }
  // A direct/foreign entry has no proven album behind it. Replace, don't loop.
  target.history.replaceState(initialAftertoneState(target.history.state), "", routePath({ name: "album", albumId }));
  return "replace";
}
