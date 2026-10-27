import { describe, expect, it } from "vitest";
import { buildAlbumQueryParams, getDecadeForYear, parseLibraryNavigation, writeLibraryNavigation } from "./pagination";
import { hasInternalBack, initialAftertoneState, nextAftertoneState } from "../../navigation";

function browser(path: string) {
  const entries = [{ path, state: initialAftertoneState(null) as unknown }];
  let index = 0;
  const url = () => new URL(entries[index].path, "http://aftertone.test");
  return {
    entries,
    location: { get pathname() { return url().pathname; }, get search() { return url().search; }, get hash() { return url().hash; } },
    get navigation() { return parseLibraryNavigation(url().searchParams); },
    history: {
      get state() { return entries[index].state; },
      pushState(state: unknown, _title: string, path?: string | URL | null) { entries.splice(++index); entries.push({ path: String(path), state }); },
      replaceState(state: unknown, _title: string, path?: string | URL | null) { entries[index] = { path: String(path), state }; },
      back() { if (index) index--; },
      forward() { if (index < entries.length - 1) index++; },
    },
  };
}

describe("library pagination navigation", () => {
  it("parses and serializes shareable filters and direction", () => expect(parseLibraryNavigation(new URLSearchParams("page=2&decade=2020&year=2024&month=2&sort=year&direction=asc&search=grace&revisit=1&unrated=true"))).toEqual({ page: 2, decade: 2020, year: 2024, month: 2, revisit: true, unrated: true, sort: "year", direction: "asc", search: "grace" }));
  it("uses sensible defaults while retaining legacy sort URLs", () => {
    expect(parseLibraryNavigation(new URLSearchParams("sort=recent"))).toMatchObject({ sort: "recent", direction: "desc" });
    expect(buildAlbumQueryParams({ page: 1, sort: "rating", direction: "desc", revisit: false, unrated: false }).toString()).toBe("");
  });
  it("persists an explicitly reversed direction with status toggles", () => expect(buildAlbumQueryParams({ page: 1, sort: "rating", direction: "asc", revisit: true, unrated: true }).toString()).toBe("revisit=1&unrated=1&direction=asc"));
  it("ignores a month without its corresponding year", () => expect(parseLibraryNavigation(new URLSearchParams("month=2"))).not.toHaveProperty("month", 2));
  it("calculates decade boundaries", () => { expect(getDecadeForYear(2019)).toBe(2010); expect(getDecadeForYear(2020)).toBe(2020); expect(getDecadeForYear(2029)).toBe(2020); expect(getDecadeForYear(2030)).toBe(2030); });

  it("keeps Home, Library and each explicit page in Back/Forward history", () => {
    const target = browser("/");
    target.history.pushState(nextAftertoneState(null), "", "/library");
    for (const page of [2, 3]) {
      writeLibraryNavigation({ ...target.navigation, page }, "push", target);
      // The React fetch/normalization effect must not turn this into another push.
      writeLibraryNavigation(target.navigation, "replace", target);
    }
    expect(target.entries.map(({ path }) => path)).toEqual(["/", "/library", "/library?page=2", "/library?page=3"]);
    for (const page of [2, 1]) { target.history.back(); expect(target.navigation.page).toBe(page); }
    target.history.back();
    expect(target.location.pathname).toBe("/");
    for (const page of [1, 2, 3]) { target.history.forward(); expect(target.location.pathname).toBe("/library"); expect(target.navigation.page).toBe(page); }
  });

  it("restores direct page 3 on refresh and normalizes without adding entries", () => {
    const target = browser("/library?page=3&sort=rating&direction=desc");
    expect(target.navigation.page).toBe(3);
    for (let call = 0; call < 3; call++) writeLibraryNavigation(target.navigation, "replace", target);
    expect(target.entries).toHaveLength(1);
    expect(target.location.search).toBe("?page=3");
    expect(hasInternalBack(target.history.state)).toBe(false);
  });

  it("does not add entries for the active page or repeated normalization", () => {
    const target = browser("/library");
    expect(writeLibraryNavigation(target.navigation, "push", target)).toBe(false);
    writeLibraryNavigation({ ...target.navigation, page: 2 }, "push", target);
    writeLibraryNavigation(target.navigation, "replace", target);
    expect(writeLibraryNavigation(target.navigation, "push", target)).toBe(false);
    expect(target.entries).toHaveLength(2);
    expect(hasInternalBack(target.history.state)).toBe(true);
  });

  it("preserves search, date/status filters, sorting, other parameters and hash", () => {
    const target = browser("/library?search=grace&decade=2020&year=2024&month=2&revisit=1&unrated=1&sort=year&direction=asc&source=shared#catalogue");
    const original = target.navigation;
    writeLibraryNavigation({ ...original, page: 3 }, "push", target);
    writeLibraryNavigation(target.navigation, "replace", target);
    expect(target.navigation).toEqual({ ...original, page: 3 });
    expect(new URLSearchParams(target.location.search).get("source")).toBe("shared");
    expect(target.location.hash).toBe("#catalogue");
    target.history.back();
    expect(target.navigation).toEqual(original);
  });

  it("keeps the existing filter reset/replace policy and paginates that new state", () => {
    const target = browser("/library");
    writeLibraryNavigation({ ...target.navigation, page: 2 }, "push", target);
    writeLibraryNavigation({ ...target.navigation, page: 3 }, "push", target);
    writeLibraryNavigation({ ...target.navigation, page: 1, year: 2024, search: "grace" }, "replace", target);
    writeLibraryNavigation({ ...target.navigation, page: 2 }, "push", target);
    target.history.back();
    expect(target.navigation).toMatchObject({ page: 1, year: 2024, search: "grace" });
    target.history.back();
    expect(target.navigation).toMatchObject({ page: 2, year: undefined, search: undefined });
    target.history.forward();
    target.history.forward();
    expect(target.navigation).toMatchObject({ page: 2, year: 2024, search: "grace" });
  });

  it("removes cleared managed filters without dropping unrelated URL values", () => {
    const target = browser("/library?page=3&year=2024&month=2&source=shared");
    writeLibraryNavigation({ ...target.navigation, page: 1, year: undefined, month: undefined }, "replace", target);
    expect(target.location.search).toBe("?source=shared");
    expect(target.entries).toHaveLength(1);
  });
});
