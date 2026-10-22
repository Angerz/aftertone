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
  it("discards an owner response that completes after logout", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    setCsrfToken("owner-session");
    const pending = request("/api/albums/1/revisions/1");
    setCsrfToken(null);
    finish(new Response('{"album_notes":"PRIVATE"}'));
    await expect(pending).rejects.toThrow("Your session changed");
  });
  it.each([
    [503, "Owner login is not configured."],
    [401, "Invalid credentials."],
  ])("preserves login failure details for status %s without expiring a session", async (status, detail) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status })));
    const expired = vi.fn(); const unsubscribe = onSessionExpired(expired);
    try {
      await expect(request("/api/auth/login", { method: "POST", body: '{"password":"synthetic-test-only"}' })).rejects.toEqual(new ApiError(detail, status));
      expect(expired).not.toHaveBeenCalled();
    } finally { unsubscribe(); }
  });
  it("distinguishes an unreachable API from login configuration errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(request("/api/auth/login", { method: "POST", body: '{"password":"synthetic-test-only"}' })).rejects.toEqual(new ApiError("Could not reach Aftertone. Please try again."));
  });
});


describe("field validation context", () => {
  it("retains only 422 field paths without exposing rejected values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ loc: ["body", "artists", 1, "name"], msg: "Invalid", input: "private rejected value" }] }), { status: 422 })));
    try { await request("/api/albums/1", { method: "PATCH", body: "{}" }); }
    catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect((cause as ApiError).validationPaths).toEqual([["body", "artists", 1, "name"]]);
      expect((cause as ApiError).message).toBe("The request could not be completed.");
      expect(JSON.stringify(cause)).not.toContain("private rejected value");
      return;
    }
    throw new Error("Expected validation failure");
  });
  it("ignores malformed field paths and keeps generic errors unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [null, { loc: "title" }] }), { status: 422 })));
    await expect(request("/api/albums/1")).rejects.toEqual(new ApiError("The request could not be completed.", 422));
  });
});
