import { describe, expect, it } from "vitest";
import { activeSection, readRoute, requiresOwner, routePath } from "./appRoutes";

describe("public entry and owner routes", () => {
  it("reads and generates stable, public revision URLs in the Library section", () => {
    for (const revisionId of [7, 42]) {
      const view = { name: "revision" as const, albumId: 3, revisionId };
      expect(readRoute(`/albums/3/revisions/${revisionId}`)).toEqual(view);
      expect(routePath(view)).toBe(`/albums/3/revisions/${revisionId}`);
      expect(requiresOwner(view)).toBe(false);
      expect(activeSection(view)).toBe("library");
    }
  });
  it.each(["0", "-1", "abc", "1.5", "1e2", "9007199254740992"])("keeps invalid revision %s on an album-associated error route", (id) => {
    expect(readRoute(`/albums/3/revisions/${id}`)).toEqual({ name: "revision", albumId: 3, revisionId: 0 });
  });
  it("assigns details and editors to their global section while leaving the landing minimal", () => {
    expect(activeSection(readRoute("/"))).toBeNull();
    for (const path of ["/library", "/albums/1", "/albums/1/edit", "/albums/1/rate"]) expect(activeSection(readRoute(path))).toBe("library");
    for (const path of ["/artists", "/artists/42", "/artists/42/tracks", "/artists/42/edit"]) expect(activeSection(readRoute(path))).toBe("artists");
    expect(activeSection(readRoute("/top-songs"))).toBe("favorites");
  });
  it("keeps the landing and library distinct, including old filtered library links", () => {
    expect(readRoute("/")).toEqual({ name: "landing" });
    expect(readRoute("/library", "?sort=title&direction=asc&page=2")).toEqual({ name: "albums" });
    expect(readRoute("/", "?year=2025&month=2")).toEqual({ name: "albums" });
    expect(routePath({ name: "albums" })).toBe("/library");
    expect(routePath({ name: "landing" })).toBe("/");
  });
  it("keeps all browsing routes public and restricts every editor/import route", () => {
    for (const path of ["/", "/library", "/artists", "/artists/42", "/artists/42/tracks", "/albums/1", "/top-songs"]) expect(requiresOwner(readRoute(path))).toBe(false);
    for (const path of ["/albums/new", "/albums/1/edit", "/albums/1/rate", "/albums/1/reconcile", "/artists/42/edit", "/import"]) expect(requiresOwner(readRoute(path))).toBe(true);
  });
});
