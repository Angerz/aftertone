export type View = { name: "landing" } | { name: "albums" } | { name: "top-songs" } | { name: "artists" } | { name: "artist"; artistId: number } | { name: "artist-tracks"; artistId: number } | { name: "artist-edit"; artistId: number } | { name: "create" } | { name: "import" } | { name: "album"; albumId: number } | { name: "edit"; albumId: number } | { name: "rate"; albumId: number } | { name: "reconcile"; albumId: number };

export function requiresOwner(view: View): boolean {
  return ["create", "import", "artist-edit", "reconcile", "edit", "rate"].includes(view.name);
}

export function legacyLibraryQuery(search: string): boolean {
  const params = new URLSearchParams(search);
  return ["search", "sort", "direction", "page", "year", "decade", "month", "revisit", "unrated"].some((key) => params.has(key));
}

export function readRoute(path: string, search = ""): View {
  const artist = path.match(/^\/artists\/(\d+)(?:\/(edit|tracks))?$/);
  if (artist) return { name: artist[2] === "edit" ? "artist-edit" : artist[2] === "tracks" ? "artist-tracks" : "artist", artistId: Number(artist[1]) };
  const album = path.match(/^\/albums\/(\d+)(?:\/(edit|rate|reconcile))?$/);
  if (album) return { name: album[2] === "edit" ? "edit" : album[2] === "rate" ? "rate" : album[2] === "reconcile" ? "reconcile" : "album", albumId: Number(album[1]) };
  if (path === "/library" || path === "/albums" || (path === "/" && legacyLibraryQuery(search))) return { name: "albums" };
  if (path === "/top-songs") return { name: "top-songs" };
  if (path === "/artists") return { name: "artists" };
  if (path === "/albums/new") return { name: "create" };
  if (path === "/import") return { name: "import" };
  return { name: "landing" };
}

export function routePath(view: View): string {
  switch (view.name) {
    case "landing": return "/";
    case "albums": return "/library";
    case "top-songs": return "/top-songs";
    case "artists": return "/artists";
    case "artist": return `/artists/${view.artistId}`;
    case "artist-tracks": return `/artists/${view.artistId}/tracks`;
    case "artist-edit": return `/artists/${view.artistId}/edit`;
    case "create": return "/albums/new";
    case "import": return "/import";
    case "album": return `/albums/${view.albumId}`;
    case "edit": return `/albums/${view.albumId}/edit`;
    case "rate": return `/albums/${view.albumId}/rate`;
    case "reconcile": return `/albums/${view.albumId}/reconcile`;
  }
}
