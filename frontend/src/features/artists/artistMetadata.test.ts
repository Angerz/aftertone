import { describe, expect, it } from "vitest";

import { artistMetadata } from "./artistMetadata";

describe("artistMetadata", () => {
  it("renders a living person's derived age without persisting one", () => {
    expect(artistMetadata({ artist_type: "person", country_code: "ES", birth_date: "1992-09-25" }, new Date("2026-09-15"))).toBe("🇪🇸 Spain · born 1992 · age 33");
  });

  it("renders a deceased person's lifespan and age at death", () => {
    expect(artistMetadata({ artist_type: "person", country_code: "GB", birth_date: "1947-01-08", death_date: "2016-01-10" })).toBe("🇬🇧 United Kingdom · 1947–2016 · Age 69");
  });

  it("renders group formation or lifespan", () => {
    expect(artistMetadata({ artist_type: "group", country_code: "FR", formed_year: 1993 })).toBe("🇫🇷 France · formed 1993");
    expect(artistMetadata({ artist_type: "group", formed_year: 1993, dissolved_year: 2021 })).toBe("1993–2021");
  });

  it("omits absent metadata cleanly", () => {
    expect(artistMetadata({ artist_type: "unknown" })).toBeNull();
  });
});
