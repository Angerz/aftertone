import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContextualNavigation } from "./ContextualNavigation";
describe("ContextualNavigation", () => { it("renders Back with stable Library and Artists destinations", () => { const markup = renderToStaticMarkup(<ContextualNavigation onBack={() => undefined} onLibrary={() => undefined} onArtists={() => undefined} />); expect(markup).toContain("← Back"); expect(markup).toContain(">Library<"); expect(markup).toContain(">Artists<"); }); });
