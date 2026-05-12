import type { ApiErrorPayload } from "./api-errors";

export class ClientApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
  }
}

export type ApiErrorResponseBody = {
  ok?: false;
  error?: string | ApiErrorPayload;
};

export async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorResponseBody;
    return apiErrorFromBody(body, fallback);
  } catch {
    return new ClientApiError(fallback);
  }
}

export function apiErrorFromBody(
  body: ApiErrorResponseBody,
  fallback: string,
) {
  if (typeof body.error === "string") {
    return new ClientApiError(body.error);
  }

  if (body.error?.message) {
    return new ClientApiError(body.error.message, body.error.code);
  }

  return new ClientApiError(fallback);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function getErrorCode(error: unknown) {
  return error instanceof ClientApiError ? error.code : undefined;
}
