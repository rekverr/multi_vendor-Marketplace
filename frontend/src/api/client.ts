import { ApiError, type ApiErrorPayload } from "./api-error";

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

interface AuthBridge {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  expire: () => void;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  authenticated?: boolean;
  retryAfterRefresh?: boolean;
}

let authBridge: AuthBridge | null = null;
let refreshRequest: Promise<string | null> | null = null;

export function configureApiAuth(bridge: AuthBridge): () => void {
  authBridge = bridge;
  return () => {
    if (authBridge === bridge) authBridge = null;
  };
}

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    body,
    headers: suppliedHeaders,
    authenticated = false,
    retryAfterRefresh = true,
    ...requestInit
  } = options;
  const headers = new Headers(suppliedHeaders);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const accessToken = authenticated ? authBridge?.getAccessToken() : null;
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(apiUrl(path), {
    ...requestInit,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (
    response.status === 401 &&
    authenticated &&
    retryAfterRefresh &&
    authBridge
  ) {
    refreshRequest ??= authBridge.refresh().finally(() => {
      refreshRequest = null;
    });
    if (await refreshRequest) {
      return apiRequest<T>(path, { ...options, retryAfterRefresh: false });
    }
    authBridge.expire();
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiDownload(
  path: string,
  retryAfterRefresh = true,
): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers({ Accept: "text/csv" });
  const accessToken = authBridge?.getAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(apiUrl(path), {
    headers,
    credentials: "include",
  });
  if (response.status === 401 && retryAfterRefresh && authBridge) {
    refreshRequest ??= authBridge.refresh().finally(() => {
      refreshRequest = null;
    });
    if (await refreshRequest) return apiDownload(path, false);
    authBridge.expire();
  }
  if (!response.ok) throw await toApiError(response);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? "marketplace-sales.csv";
  return { blob: await response.blob(), filename };
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return new ApiError(response.status, payload);
  } catch {
    return new ApiError(response.status);
  }
}
