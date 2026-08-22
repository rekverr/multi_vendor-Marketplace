export interface ApiErrorPayload {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  correlationId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  readonly details: string[];

  constructor(status: number, payload: ApiErrorPayload = {}) {
    const details = Array.isArray(payload.message)
      ? payload.message
      : payload.message
        ? [payload.message]
        : [];
    super(details[0] ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code ?? "HTTP_ERROR";
    this.correlationId = payload.correlationId;
    this.details = details;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
