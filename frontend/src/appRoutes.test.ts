import { describe, expect, it } from "vitest";
import { readRoute, requiresOwner, routePath } from "./appRoutes";

describe("public entry and owner routes", () => {
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
