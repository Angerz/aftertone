import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContextualNavigation } from "./ContextualNavigation";
describe("ContextualNavigation", () => { it("keeps only the contextual Back action", () => { const markup = renderToStaticMarkup(<ContextualNavigation onBack={() => undefined} />); expect(markup).toContain("← Back"); expect(markup).not.toContain(">Library<"); expect(markup).not.toContain(">Artists<"); }); });
