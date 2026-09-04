const API_URL = import.meta.env.VITE_AFTERTONE_API_URL ?? "http://127.0.0.1:8017";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }); }
  catch { throw new ApiError("Could not reach Aftertone. Is the API running?"); }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === "object" && "detail" in body ? String(body.detail) : "The request could not be completed.";
    throw new ApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}
