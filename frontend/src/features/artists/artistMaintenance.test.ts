import { describe, expect, it } from "vitest";
import { artistFilterParams, canDeleteArtist, pickerArtistParams } from "./artistMaintenance";

describe("artist maintenance helpers", () => {
  it("maps All, Active, Inactive, and Unused filters to API filters", () => {
    expect(artistFilterParams("all")).toEqual({});
    expect(artistFilterParams("active")).toEqual({ active: true });
    expect(artistFilterParams("inactive")).toEqual({ active: false });
    expect(artistFilterParams("unused")).toEqual({ unused: true });
  });

  it("only offers deletion for backend-confirmed unused artists", () => {
    expect(canDeleteArtist({ id: 1, name: "Unused", is_unused: true })).toBe(true);
    expect(canDeleteArtist({ id: 2, name: "Used", is_unused: false })).toBe(false);
  });

  it("searches only active artists in pickers", () => {
    expect(pickerArtistParams("Artist")).toEqual({ search: "Artist", page: 1, page_size: 12, active: true });
  });
});
