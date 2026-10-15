import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ArtistTrackControls } from "./ArtistTrackControls";

it("keeps the chosen criterion and direction visible while the mobile panel is closed", () => {
  const noop = () => undefined;
  const markup = renderToStaticMarkup(<ArtistTrackControls search="Álvaro" sort="release_date" direction="asc" onSearch={noop} onSort={noop} onDirection={noop} />);
  expect(markup).toContain('aria-expanded="false" aria-controls="artist-track-mobile-sort"');
  expect(markup).toContain('aria-label="Track sorting" hidden=""');
  expect(markup).toContain("Release date, ascending");
  expect(markup).toContain('aria-label="Ascending" title="Ascending" aria-pressed="true"');
  expect(markup).toContain('<option value="release_date" selected="">Release date</option>');
});
