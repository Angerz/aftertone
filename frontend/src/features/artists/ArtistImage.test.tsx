import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtistImage, artistInitials } from "./ArtistImage";

describe("ArtistImage", () => {
  it("renders initials for an artist without a portrait", () => {
    expect(artistInitials("Fiona Apple")).toBe("FA");
    const markup = renderToStaticMarkup(<ArtistImage artist={{ name: "Fiona Apple", image_url: null }} />);
    expect(markup).toContain("artist-image-placeholder");
    expect(markup).toContain(">FA<");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("renders a local portrait when one is available", () => {
    const markup = renderToStaticMarkup(<ArtistImage artist={{ name: "Fiona Apple", image_url: "/media/covers/portrait.webp" }} />);
    expect(markup).toContain('src="http://127.0.0.1:8017/media/covers/portrait.webp"');
    expect(markup).toContain('alt="Portrait of Fiona Apple"');
  });
});
