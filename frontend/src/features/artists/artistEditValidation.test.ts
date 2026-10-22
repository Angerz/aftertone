import { describe, expect, it } from "vitest";
import { artistEditErrorField, validateArtistEdit } from "./artistEditValidation";

const fields = { name: " Artist ", countryCode: "pe", formedYear: "", dissolvedYear: "" };

describe("artist editor validation", () => {
  it("keeps required name and ISO-code rules, including trimmed values", () => {
    expect(validateArtistEdit(fields)).toBeNull();
    expect(validateArtistEdit({ ...fields, name: " " })).toEqual({ field: "name", message: "Artist name is required." });
    expect(validateArtistEdit({ ...fields, countryCode: "P" })?.field).toBe("country_code");
    expect(validateArtistEdit({ ...fields, countryCode: " PE " })).toBeNull();
    expect(validateArtistEdit({ ...fields, countryCode: "  " })?.field).toBe("country_code");
    expect(validateArtistEdit({ ...fields, countryCode: "" })).toBeNull();
  });
  it("preserves optional integer year bounds and points to the first invalid year", () => {
    for (const value of ["", "1", "1998", "9999"]) expect(validateArtistEdit({ ...fields, formedYear: value, dissolvedYear: value })).toBeNull();
    for (const value of ["0", "10000", "1998.5", "bad"]) {
      expect(validateArtistEdit({ ...fields, formedYear: value, dissolvedYear: value })).toEqual({ field: "formed_year", message: "Enter valid four-digit years." });
      expect(validateArtistEdit({ ...fields, formedYear: "1998", dissolvedYear: value })?.field).toBe("dissolved_year");
    }
  });
  it("maps only artist body fields from structured server validation", () => {
    expect(artistEditErrorField([["body", "birth_date"]])).toBe("birth_date");
    expect(artistEditErrorField([["body", "country_code"]])).toBe("country_code");
    expect(artistEditErrorField([["query", "name"], ["body", "tracks", 0, "name"]])).toBeNull();
  });
});
