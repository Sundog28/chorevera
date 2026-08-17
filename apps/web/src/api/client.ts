import type {
  ApiErrorResponse,
} from "../types/auth";


export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000";

export const ACCESS_TOKEN_STORAGE_KEY =
  "choreflow-access-token";

export const ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY =
  "choreflow-access-token-expires-at";

export const AUTH_SESSION_EXPIRED_EVENT =
  "choreflow:session-expired";


type SessionExpiredDetail = {
  message: string;
};


let hasDispatchedSessionExpired =
  false;


export class ApiError extends Error {
  readonly status: number;
  readonly path: string;


  constructor(
    message: string,
    status: number,
    path: string,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}


export function getStoredAccessToken():
string | null {
  return localStorage.getItem(
    ACCESS_TOKEN_STORAGE_KEY,
  );
}


export function storeAccessToken(
  token: string,
  expiresInSeconds?: number,
): void {
  localStorage.setItem(
    ACCESS_TOKEN_STORAGE_KEY,
    token,
  );

  if (
    expiresInSeconds !== undefined &&
    Number.isFinite(
      expiresInSeconds,
    )
  ) {
    const expiresAt =
      Date.now() +
      Math.max(
        0,
        expiresInSeconds,
      ) *
        1000;

    localStorage.setItem(
      ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY,
      String(expiresAt),
    );
  } else {
    localStorage.removeItem(
      ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY,
    );
  }

  hasDispatchedSessionExpired =
    false;
}


export function removeStoredAccessToken():
void {
  localStorage.removeItem(
    ACCESS_TOKEN_STORAGE_KEY,
  );

  localStorage.removeItem(
    ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY,
  );
}


function readJwtExpiry(
  token: string,
): number | null {
  const parts =
    token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    const normalizedPayload =
      parts[1]
        .replace(
          /-/g,
          "+",
        )
        .replace(
          /_/g,
          "/",
        );

    const paddedPayload =
      normalizedPayload.padEnd(
        Math.ceil(
          normalizedPayload.length /
            4,
        ) * 4,
        "=",
      );

    const payload =
      JSON.parse(
        atob(
          paddedPayload,
        ),
      ) as {
        exp?: number;
      };

    return typeof payload.exp ===
      "number"
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}


export function isStoredAccessTokenExpired():
boolean {
  const token =
    getStoredAccessToken();

  if (!token) {
    return false;
  }

  const storedExpiry =
    Number(
      localStorage.getItem(
        ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY,
      ),
    );

  const expiresAt =
    Number.isFinite(
      storedExpiry,
    ) &&
    storedExpiry > 0
      ? storedExpiry
      : readJwtExpiry(
          token,
        );

  if (expiresAt === null) {
    return false;
  }

  return Date.now() >=
    expiresAt - 5_000;
}


function dispatchSessionExpired(
  message: string,
): void {
  if (
    hasDispatchedSessionExpired
  ) {
    return;
  }

  hasDispatchedSessionExpired =
    true;

  window.dispatchEvent(
    new CustomEvent<SessionExpiredDetail>(
      AUTH_SESSION_EXPIRED_EVENT,
      {
        detail: {
          message,
        },
      },
    ),
  );
}


function extractErrorMessage(
  responseBody:
    ApiErrorResponse | null,
  fallbackMessage: string,
): string {
  if (!responseBody?.detail) {
    return fallbackMessage;
  }

  if (
    typeof responseBody.detail ===
    "string"
  ) {
    return responseBody.detail;
  }

  const firstError =
    responseBody.detail[0];

  return firstError?.msg ??
    fallbackMessage;
}


export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    getStoredAccessToken();

  if (
    token &&
    isStoredAccessTokenExpired()
  ) {
    removeStoredAccessToken();

    const message =
      "Your session expired. Sign in again to continue.";

    dispatchSessionExpired(
      message,
    );

    throw new ApiError(
      message,
      401,
      path,
    );
  }

  const headers =
    new Headers(
      options.headers,
    );

  if (
    options.body &&
    !(
      options.body instanceof
      FormData
    ) &&
    !headers.has(
      "Content-Type",
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers,
      },
    );
  } catch {
    throw new ApiError(
      "Unable to reach the Chorevera API. Make sure the FastAPI server is running.",
      0,
      path,
    );
  }

  if (!response.ok) {
    let errorBody:
      ApiErrorResponse | null =
      null;

    try {
      errorBody =
        (await response.json()) as
          ApiErrorResponse;
    } catch {
      errorBody = null;
    }

    const message =
      extractErrorMessage(
        errorBody,
        `Request failed with status ${response.status}.`,
      );

    if (
      response.status === 401
    ) {
      removeStoredAccessToken();

      dispatchSessionExpired(
        "Your session is no longer valid. Sign in again to continue.",
      );
    }

    throw new ApiError(
      message,
      response.status,
      path,
    );
  }

  if (
    response.status === 204
  ) {
    return undefined as T;
  }

  return (
    await response.json()
  ) as T;
}

