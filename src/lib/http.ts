/**
 * Centralised HTTP client for the RecoverAI FastAPI backend.
 *
 * Base URL comes from VITE_API_BASE_URL and falls back to http://localhost:8000.
 */

export const API_BASE_URL =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function toCamel(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Backends usually speak snake_case; the UI types are camelCase. */
export function camelize<T>(input: unknown): T {
  if (Array.isArray(input)) return input.map((v) => camelize(v)) as unknown as T;
  if (input && typeof input === "object" && !(input instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[toCamel(k)] = camelize(v);
    }
    return out as T;
  }
  return input as T;
}

async function parseError(res: Response) {
  try {
    const body = (await res.json()) as { detail?: unknown; message?: unknown };
    const detail = body.detail ?? body.message;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
  } catch {
    /* ignore */
  }
  return `${res.status} ${res.statusText}`;
}

export async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      ...(init?.signal ? { signal: init.signal } : {}),
    });
  } catch {
    throw new ApiError(
      `Cannot reach the RecoverAI backend at ${API_BASE_URL}. Make sure it is running.`,
      0,
    );
  }
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return camelize<T>(JSON.parse(text));
}

export const api = {
  get: <T,>(path: string, signal?: AbortSignal) =>
    request<T>(path, signal ? { signal } : {}),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, body === undefined ? { method: "POST" } : { method: "POST", body }),
};
