const API_URL = import.meta.env.VITE_AFTERTONE_API_URL ?? "";
export const mediaUrl = (path: string) => `${API_URL}${path}`;
let csrfToken: string | null = null;
export const setCsrfToken = (value: string | null) => { csrfToken = value; };
const sessionListeners = new Set<() => void>();
export const onSessionExpired = (listener: () => void) => { sessionListeners.add(listener); return () => { sessionListeners.delete(listener); }; };

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const isFormData = init?.body instanceof FormData;
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init?.headers);
  if (!isFormData && init?.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) headers.set("X-CSRF-Token", csrfToken);
  try { response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", cache: "no-store", headers }); }
  catch { throw new ApiError("Could not reach Aftertone. Please try again."); }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/login") {
      csrfToken = null;
      sessionListeners.forEach((listener) => listener());
    }
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === "object" && "detail" in body && typeof body.detail === "string" ? body.detail : "The request could not be completed.";
    throw new ApiError(response.status === 401 ? "Owner login required. Please sign in again." : detail, response.status);
  }
  return response.json() as Promise<T>;
}
