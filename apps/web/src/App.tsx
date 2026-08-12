import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Home,
  LayoutDashboard,
  LogOut,
  UserRound,
} from "lucide-react";

import { useAuth } from "./context/AuthContext";

import {
  BillingProvider,
} from "./context/BillingContext";

import {
  FeatureProvider,
} from "./context/FeatureContext";

import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import Household from "./pages/Household";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";


type AuthScreen =
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email";

type AppPage =
  | "dashboard"
  | "household";


const ACTIVE_PAGE_STORAGE_KEY =
  "choreflow-active-page";


function getInitialPage(): AppPage {
  const savedPage =
    sessionStorage.getItem(
      ACTIVE_PAGE_STORAGE_KEY,
    );

  return savedPage === "household"
    ? "household"
    : "dashboard";
}


function readAuthLink() {
  const parameters =
    new URLSearchParams(
      window.location.search,
    );

  return {
    resetToken:
      parameters.get(
        "reset_token",
      ) ?? "",

    verifyToken:
      parameters.get(
        "verify_token",
      ) ?? "",
  };
}


function clearAuthLink(): void {
  window.history.replaceState(
    {},
    "",
    window.location.pathname,
  );
}


function App() {
  const {
    user,
    isAuthenticated,
    isLoading,
    sessionMessage,
    sessionRestoreError,
    clearSessionMessage,
    retrySessionRestore,
    logout,
  } = useAuth();

  const authLink =
    useMemo(
      readAuthLink,
      [],
    );

  const [
    authScreen,
    setAuthScreen,
  ] = useState<AuthScreen>(
    authLink.resetToken
      ? "reset-password"
      : authLink.verifyToken
        ? "verify-email"
        : "login",
  );

  const [
    verificationEmail,
    setVerificationEmail,
  ] = useState("");

  const [
    activePage,
    setActivePage,
  ] = useState<AppPage>(
    getInitialPage,
  );


  useEffect(() => {
    sessionStorage.setItem(
      ACTIVE_PAGE_STORAGE_KEY,
      activePage,
    );
  }, [activePage]);


  function showLogin(): void {
    clearAuthLink();

    setAuthScreen(
      "login",
    );
  }


  if (isLoading) {
    return (
      <main className="app-loading-screen">
        <div
          aria-label="Loading"
          className="loading-spinner"
          role="status"
        />

        <h1>ChoreFlow</h1>

        <p>
          Restoring your secure session...
        </p>
      </main>
    );
  }


  if (sessionRestoreError) {
    return (
      <main className="session-restore-screen">
        <section className="session-restore-card">
          <div className="session-restore-icon">
            !
          </div>

          <span className="eyebrow">
            Connection problem
          </span>

          <h1>
            ChoreFlow could not restore
            your session
          </h1>

          <p>
            {sessionRestoreError}
          </p>

          <div className="session-restore-actions">
            <button
              className="primary-button"
              onClick={() => {
                void retrySessionRestore();
              }}
              type="button"
            >
              Try again
            </button>

            <button
              className="secondary-button"
              onClick={logout}
              type="button"
            >
              Sign in instead
            </button>
          </div>
        </section>
      </main>
    );
  }


  if (!isAuthenticated) {
    return (
      <div className="auth-screen-shell">
        {sessionMessage && (
          <div
            className="auth-session-banner"
            role="status"
          >
            <div>
              <strong>
                Session ended
              </strong>

              <span>
                {sessionMessage}
              </span>
            </div>

            <button
              aria-label="Dismiss session message"
              onClick={
                clearSessionMessage
              }
              type="button"
            >
              ×
            </button>
          </div>
        )}

        {authScreen === "register" && (
          <Register
            onRegistered={(
              email,
            ) => {
              setVerificationEmail(
                email,
              );

              setAuthScreen(
                "verify-email",
              );
            }}
            onShowLogin={
              showLogin
            }
          />
        )}

        {authScreen === "forgot-password" && (
          <ForgotPassword
            onShowLogin={
              showLogin
            }
          />
        )}

        {authScreen === "reset-password" && (
          <ResetPassword
            onComplete={
              showLogin
            }
            token={
              authLink.resetToken
            }
          />
        )}

        {authScreen === "verify-email" && (
          <VerifyEmail
            email={
              verificationEmail
            }
            onComplete={
              showLogin
            }
            token={
              authLink.verifyToken
            }
          />
        )}

        {authScreen === "login" && (
          <Login
            onForgotPassword={() =>
              setAuthScreen(
                "forgot-password",
              )
            }
            onShowRegister={() => {
              clearSessionMessage();

              setAuthScreen(
                "register",
              );
            }}
          />
        )}
      </div>
    );
  }


  return (
    <BillingProvider>
      <FeatureProvider>
        <div className="authenticated-app">
          <div className="account-bar">
            <div className="account-identity">
              <div className="account-avatar">
                <UserRound size={18} />
              </div>

              <div>
                <strong>
                  {user?.name}
                </strong>

                <span>
                  {user?.email}
                </span>
              </div>
            </div>

            <button
              className="account-logout-button"
              onClick={logout}
              type="button"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>

          <nav
            aria-label="Main navigation"
            className="app-navigation"
          >
            <button
              aria-current={
                activePage === "dashboard"
                  ? "page"
                  : undefined
              }
              className={
                activePage ===
                "dashboard"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActivePage(
                  "dashboard",
                )
              }
              type="button"
            >
              <LayoutDashboard
                size={18}
              />
              Dashboard
            </button>

            <button
              aria-current={
                activePage === "household"
                  ? "page"
                  : undefined
              }
              className={
                activePage ===
                "household"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActivePage(
                  "household",
                )
              }
              type="button"
            >
              <Home size={18} />
              Household
            </button>
          </nav>

          {activePage ===
          "dashboard" ? (
            <Dashboard />
          ) : (
            <Household />
          )}
        </div>
      </FeatureProvider>
    </BillingProvider>
  );
}


export default App;
