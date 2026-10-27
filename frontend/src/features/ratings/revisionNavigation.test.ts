import { describe, expect, it } from "vitest";
import { readRoute } from "../../appRoutes";
import { initialAftertoneState, nextAftertoneState } from "../../navigation";
import { openAlbumRevision, returnToRevisionAlbum } from "./revisionNavigation";

function browser(path: string) {
  const entries = [{ path, state: initialAftertoneState(null) as unknown }];
  let index = 0;
  return {
    entries,
    location: { get pathname() { return entries[index].path.split("?")[0]; } },
    get url() { return entries[index].path; },
    get view() { return readRoute(entries[index].path); },
    history: {
      get state() { return entries[index].state; },
      pushState(state: unknown, _title: string, url?: string | URL | null) { entries.splice(++index); entries.push({ path: String(url), state }); },
      replaceState(state: unknown, _title: string, url?: string | URL | null) { entries[index] = { path: String(url), state }; },
      back() { if (index) index--; },
      forward() { if (index < entries.length - 1) index++; },
    },
  };
}

describe("album revision history", () => {
  it("pushes an independent revision after Library/Album and restores both with Back/Forward", () => {
    const target = browser("/library?search=Grace&sort=title&page=2");
    target.history.pushState(nextAftertoneState(null), "", "/albums/3");
    expect(openAlbumRevision(3, 7, target)).toBe(true);
    expect(target.entries).toHaveLength(3);
    expect(target.url).toBe("/albums/3/revisions/7");
    target.history.back();
    expect(target.view).toEqual({ name: "album", albumId: 3 });
    target.history.forward();
    expect(target.view).toEqual({ name: "revision", albumId: 3, revisionId: 7 });
    expect(returnToRevisionAlbum(3, target)).toBe("back");
    expect(target.url).toBe("/albums/3");
    target.history.back();
    expect(target.url).toBe("/library?search=Grace&sort=title&page=2");
  });

  it("does not duplicate entries when selecting an already-open revision", () => {
    const target = browser("/albums/3");
    openAlbumRevision(3, 7, target);
    expect(openAlbumRevision(3, 7, target)).toBe(false);
    expect(target.entries).toHaveLength(2);
  });

  it("preserves the album return marker across refresh without adding an entry", () => {
    const target = browser("/albums/3");
    openAlbumRevision(3, 7, target);
    target.history.replaceState(initialAftertoneState(target.history.state), "", target.url);
    expect(returnToRevisionAlbum(3, target)).toBe("back");
    expect(target.url).toBe("/albums/3");
    expect(target.entries).toHaveLength(2);
  });

  it("replaces a direct revision with its album rather than creating a loop", () => {
    const target = browser("/albums/3/revisions/7");
    expect(target.view).toEqual({ name: "revision", albumId: 3, revisionId: 7 });
    expect(returnToRevisionAlbum(3, target)).toBe("replace");
    expect(target.url).toBe("/albums/3");
    expect(target.entries).toHaveLength(1);
  });

  it("never backs into a different album just because an internal entry exists", () => {
    const target = browser("/albums/9");
    openAlbumRevision(3, 7, target);
    expect(returnToRevisionAlbum(3, target)).toBe("replace");
    expect(target.url).toBe("/albums/3");
    expect(target.entries).toHaveLength(2);
  });

  it("uses revision IDs, including multiple revisions with the same album", () => {
    const target = browser("/albums/3");
    openAlbumRevision(3, 7, target);
    returnToRevisionAlbum(3, target);
    openAlbumRevision(3, 42, target);
    expect(target.url).toBe("/albums/3/revisions/42");
    target.history.back();
    target.history.forward();
    expect(target.view).toEqual({ name: "revision", albumId: 3, revisionId: 42 });
    expect(target.entries).toHaveLength(2);
  });

  it("keeps the rating editor out of the album/snapshot back path", () => {
    const target = browser("/library");
    target.history.pushState(nextAftertoneState(null), "", "/albums/3/rate");
    openAlbumRevision(3, 7, target);
    expect(target.entries.map(({ path }) => path)).toEqual(["/library", "/albums/3", "/albums/3/revisions/7"]);
    returnToRevisionAlbum(3, target);
    target.history.back();
    expect(target.url).toBe("/library");
  });
});
