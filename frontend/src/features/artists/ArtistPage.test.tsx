import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArtistPage } from "./ArtistPage";

describe("ArtistPage", () => {
  it("keeps image mutation controls out of the read-only detail surface", () => {
    const markup = renderToStaticMarkup(<ArtistPage artistId={1} onBack={() => undefined} onAlbum={() => undefined} onEdit={() => undefined} />);
    expect(markup).not.toContain("Change image");
    expect(markup).not.toContain("Import from URL");
  });
});
