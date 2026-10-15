import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { FavoriteSongControls } from "./FavoriteSongControls";

it("identifies the selected sorting while keeping the mobile panel closed", () => {
  const noop = () => undefined;
  const markup = renderToStaticMarkup(<FavoriteSongControls search="Björk" sort="replay_value" onSearch={noop} onSort={noop} />);
  expect(markup).toContain('aria-expanded="false" aria-controls="favorite-mobile-sort"');
  expect(markup).toContain('aria-label="Song sorting" hidden=""');
  expect(markup).toContain("Sort: Replay value");
  expect(markup).toContain('value="Björk"');
  expect(markup).toContain('<option value="replay_value" selected="">Replay value</option>');
});
