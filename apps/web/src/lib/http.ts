export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

import { isUiBugModeEnabled } from "./bugs";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
};

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const errorPayload = payload as
      | {
          error?: {
            code?: string;
            message?: string;
          };
        }
      | undefined;

    const message =
      response.status === 500 && isUiBugModeEnabled()
        ? "Invalid email or password"
        : (errorPayload?.error?.message ?? `Request failed with status ${response.status}`);
    const code = errorPayload?.error?.code;
    throw new ApiError(message, response.status, code);
  }

  return (await response.json()) as T;
};
