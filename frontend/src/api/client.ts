const API_URL = import.meta.env.VITE_AFTERTONE_API_URL ?? "";
export const mediaUrl = (path: string) => `${API_URL}${path}`;
let csrfToken: string | null = null;
let sessionVersion = 0;
export const setCsrfToken = (value: string | null) => { if (csrfToken !== value) sessionVersion += 1; csrfToken = value; };
const sessionListeners = new Set<() => void>();
export const onSessionExpired = (listener: () => void) => { sessionListeners.add(listener); return () => { sessionListeners.delete(listener); }; };

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly validationPaths: readonly (readonly (string | number)[])[] = []) { super(message); }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const startedVersion = sessionVersion;
  let response: Response;
  const isFormData = init?.body instanceof FormData;
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init?.headers);
  if (!isFormData && init?.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  try { response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", cache: "no-store", headers }); }
  catch { throw new ApiError("Could not reach Aftertone. Please try again."); }
  if (startedVersion !== sessionVersion) throw new ApiError("Your session changed. Please try again.");
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/login") {
      setCsrfToken(null);
      sessionListeners.forEach((listener) => listener());
    }
    const body: unknown = await response.json().catch(() => null);
    const rawDetail = body && typeof body === "object" && "detail" in body ? body.detail : null;
    const detail = typeof rawDetail === "string" ? rawDetail : "The request could not be completed.";
    const validationPaths = response.status === 422 && Array.isArray(rawDetail) ? rawDetail.flatMap((issue: unknown) => {
      if (!issue || typeof issue !== "object" || !("loc" in issue) || !Array.isArray(issue.loc)) return [];
      return [issue.loc.filter((part: unknown): part is string | number => typeof part === "string" || typeof part === "number")];
    }) : [];
    throw new ApiError(response.status === 401 && path !== "/api/auth/login" ? "Owner login required. Please sign in again." : detail, response.status, validationPaths);
  }
  const result = await response.json() as T;
  if (startedVersion !== sessionVersion) throw new ApiError("Your session changed. Please try again.");
  return result;
}
