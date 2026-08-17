import {
  API_BASE_URL,
  ApiError,
  apiRequest,
} from "./client";

import type {
  ApiErrorResponse,
  AuthMessageResponse,
  LoginInput,
  RegistrationResponse,
  RegisterInput,
  TokenResponse,
  User,
} from "../types/auth";


export async function registerUser(
  input: RegisterInput,
): Promise<RegistrationResponse> {
  return apiRequest<RegistrationResponse>(
    "/api/v1/auth/register",
    {
      method: "POST",
      body: JSON.stringify(
        input,
      ),
    },
  );
}


export async function loginUser(
  input: LoginInput,
): Promise<TokenResponse> {
  const formBody =
    new URLSearchParams();

  formBody.set(
    "username",
    input.email,
  );

  formBody.set(
    "password",
    input.password,
  );

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          formBody.toString(),
      },
    );
  } catch {
    throw new ApiError(
      "Unable to reach the Chorevera API. Make sure the FastAPI server is running.",
      0,
      "/api/v1/auth/login",
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

    let message =
      "Unable to sign in with those credentials.";

    if (
      typeof errorBody?.detail ===
      "string"
    ) {
      message =
        errorBody.detail;
    }

    throw new ApiError(
      message,
      response.status,
      "/api/v1/auth/login",
    );
  }

  return (
    await response.json()
  ) as TokenResponse;
}


export async function getCurrentUser():
Promise<User> {
  return apiRequest<User>(
    "/api/v1/auth/me",
  );
}


export async function requestEmailVerification(
  email: string,
): Promise<AuthMessageResponse> {
  return apiRequest<AuthMessageResponse>(
    "/api/v1/auth/email-verification/request",
    {
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    },
  );
}


export async function confirmEmailVerification(
  token: string,
): Promise<AuthMessageResponse> {
  return apiRequest<AuthMessageResponse>(
    "/api/v1/auth/email-verification/confirm",
    {
      method: "POST",
      body: JSON.stringify({
        token,
      }),
    },
  );
}


export async function requestPasswordReset(
  email: string,
): Promise<AuthMessageResponse> {
  return apiRequest<AuthMessageResponse>(
    "/api/v1/auth/password-reset/request",
    {
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    },
  );
}


export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<AuthMessageResponse> {
  return apiRequest<AuthMessageResponse>(
    "/api/v1/auth/password-reset/confirm",
    {
      method: "POST",
      body: JSON.stringify({
        token,
        new_password:
          newPassword,
      }),
    },
  );
}

