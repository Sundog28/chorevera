import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentUser,
  loginUser,
  registerUser,
} from "../api/auth";

import {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_SESSION_EXPIRED_EVENT,
  ApiError,
  getStoredAccessToken,
  isStoredAccessTokenExpired,
  removeStoredAccessToken,
  storeAccessToken,
} from "../api/client";

import type {
  LoginInput,
  RegistrationResponse,
  RegisterInput,
  User,
} from "../types/auth";


type SessionExpiredEvent =
  CustomEvent<{
    message: string;
  }>;


type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionMessage: string | null;
  sessionRestoreError: string | null;

  login:
    (input: LoginInput) =>
      Promise<void>;

  register:
    (input: RegisterInput) =>
      Promise<RegistrationResponse>;

  retrySessionRestore:
    () => Promise<void>;

  clearSessionMessage:
    () => void;

  logout:
    () => void;
};


const AuthContext =
  createContext<
    AuthContextValue | null
  >(null);


type AuthProviderProps = {
  children: ReactNode;
};


let sessionRestorePromise:
  Promise<User> | null =
  null;


function requestCurrentUserOnce():
Promise<User> {
  if (!sessionRestorePromise) {
    sessionRestorePromise =
      getCurrentUser().finally(
        () => {
          sessionRestorePromise =
            null;
        },
      );
  }

  return sessionRestorePromise;
}


export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [
    user,
    setUser,
  ] = useState<User | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    sessionMessage,
    setSessionMessage,
  ] = useState<
    string | null
  >(null);

  const [
    sessionRestoreError,
    setSessionRestoreError,
  ] = useState<
    string | null
  >(null);


  const restoreSession =
    useCallback(
      async (): Promise<void> => {
        const token =
          getStoredAccessToken();

        setSessionRestoreError(
          null,
        );

        if (!token) {
          setUser(null);
          setIsLoading(false);

          return;
        }

        if (
          isStoredAccessTokenExpired()
        ) {
          removeStoredAccessToken();

          setUser(null);

          setSessionMessage(
            "Your previous session expired. Sign in again to continue.",
          );

          setIsLoading(false);

          return;
        }

        setIsLoading(true);

        try {
          const currentUser =
            await requestCurrentUserOnce();

          setUser(
            currentUser,
          );

          setSessionMessage(
            null,
          );
        } catch (error) {
          if (
            error instanceof
              ApiError &&
            error.status === 401
          ) {
            removeStoredAccessToken();

            setUser(null);

            setSessionMessage(
              "Your previous session is no longer valid. Sign in again.",
            );
          } else {
            setUser(null);

            setSessionRestoreError(
              error instanceof Error
                ? error.message
                : "Chorevera could not restore your session.",
            );
          }
        } finally {
          setIsLoading(false);
        }
      },
      [],
    );


  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);


  useEffect(() => {
    function handleSessionExpired(
      event: Event,
    ): void {
      const customEvent =
        event as
          SessionExpiredEvent;

      setUser(null);

      setSessionRestoreError(
        null,
      );

      setSessionMessage(
        customEvent.detail
          ?.message ??
          "Your session expired. Sign in again to continue.",
      );

      setIsLoading(false);
    }


    function handleStorage(
      event: StorageEvent,
    ): void {
      if (
        event.key !==
        ACCESS_TOKEN_STORAGE_KEY
      ) {
        return;
      }

      if (!event.newValue) {
        setUser(null);

        setSessionMessage(
          "You were signed out in another browser tab.",
        );

        setIsLoading(false);

        return;
      }

      void restoreSession();
    }


    window.addEventListener(
      AUTH_SESSION_EXPIRED_EVENT,
      handleSessionExpired,
    );

    window.addEventListener(
      "storage",
      handleStorage,
    );

    return () => {
      window.removeEventListener(
        AUTH_SESSION_EXPIRED_EVENT,
        handleSessionExpired,
      );

      window.removeEventListener(
        "storage",
        handleStorage,
      );
    };
  }, [restoreSession]);


  const login =
    useCallback(
      async (
        input: LoginInput,
      ): Promise<void> => {
        setSessionMessage(
          null,
        );

        setSessionRestoreError(
          null,
        );

        const tokenResponse =
          await loginUser(
            input,
          );

        storeAccessToken(
          tokenResponse.access_token,
          tokenResponse.expires_in,
        );

        try {
          const currentUser =
            await getCurrentUser();

          setUser(
            currentUser,
          );
        } catch (error) {
          removeStoredAccessToken();

          setUser(null);

          throw error;
        }
      },
      [],
    );


  const register =
    useCallback(
      async (
        input: RegisterInput,
      ): Promise<RegistrationResponse> => {
        setSessionMessage(
          null,
        );

        setSessionRestoreError(
          null,
        );

        return registerUser(
          input,
        );
      },
      [],
    );


  const logout =
    useCallback(
      (): void => {
        removeStoredAccessToken();

        setUser(null);

        setSessionMessage(
          null,
        );

        setSessionRestoreError(
          null,
        );

        setIsLoading(false);
      },
      [],
    );


  const clearSessionMessage =
    useCallback(
      (): void => {
        setSessionMessage(
          null,
        );
      },
      [],
    );


  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        isAuthenticated:
          user !== null,
        isLoading,
        sessionMessage,
        sessionRestoreError,
        login,
        register,
        retrySessionRestore:
          restoreSession,
        clearSessionMessage,
        logout,
      }),
      [
        user,
        isLoading,
        sessionMessage,
        sessionRestoreError,
        login,
        register,
        restoreSession,
        clearSessionMessage,
        logout,
      ],
    );


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth():
AuthContextValue {
  const context =
    useContext(
      AuthContext,
    );

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}

