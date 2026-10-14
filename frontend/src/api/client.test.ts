import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, mediaUrl, onSessionExpired, request, setCsrfToken } from "./client";

afterEach(() => { vi.unstubAllGlobals(); setCsrfToken(null); });
describe("authenticated API transport", () => {
  it("uses same-origin media and includes session cookies and CSRF tokens", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    setCsrfToken("session-bound-token");
    await request("/api/artists", { method: "POST", body: '{"name":"Synthetic"}' });
    const [path, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/artists");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("session-bound-token");
    expect(mediaUrl("/media/covers/test.webp")).toBe("/media/covers/test.webp");
  });
  it("lets the browser set multipart boundaries", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal("fetch", fetch);
    await request("/api/albums/1/cover", { method: "PUT", body: new FormData() });
    expect(new Headers(fetch.mock.calls[0][1].headers).has("Content-Type")).toBe(false);
  });
  it("clears expired session state on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"detail":"Owner login required."}', { status: 401 })));
    const expired = vi.fn(); const unsubscribe = onSessionExpired(expired);
    await expect(request("/api/artists", { method: "POST", body: '{}' })).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce(); unsubscribe();
  });
  it("reports 403 without retrying a mutation or treating it as logout", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"detail":"Invalid CSRF token."}', { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    const expired = vi.fn(); const unsubscribe = onSessionExpired(expired);
    await expect(request("/api/artists", { method: "POST", body: '{}' })).rejects.toEqual(new ApiError("Invalid CSRF token.", 403));
    expect(fetch).toHaveBeenCalledOnce(); expect(expired).not.toHaveBeenCalled(); unsubscribe();
  });
});
