import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtistImageControls } from "./ArtistImageControls";

describe("ArtistImageControls", () => {
  it("offers upload and URL import for an artist without an image", () => {
    const markup = renderToStaticMarkup(<ArtistImageControls artist={{ id: 1, name: "Artist", image_url: null }} onUpdated={() => undefined} />);
    expect(markup).toContain("Upload image");
    expect(markup).toContain("Import from URL");
    expect(markup).not.toContain('class="artist-image-url"');
    expect(markup).not.toContain("Remove</button>");
  });

  it("offers replacement and removal when a local image exists", () => {
    const markup = renderToStaticMarkup(<ArtistImageControls artist={{ id: 1, name: "Artist", image_url: "/media/covers/portrait.webp" }} onUpdated={() => undefined} />);
    expect(markup).toContain("Change image");
    expect(markup).toContain("Import from URL");
    expect(markup).toContain("Remove");
  });
});
