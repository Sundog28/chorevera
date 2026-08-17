import {
  type FormEvent,
  useState,
} from "react";

import {
  CheckCircle2,
  LockKeyhole,
  LogIn,
  Mail,
  Send,
} from "lucide-react";

import {
  requestEmailVerification,
} from "../api/auth";

import {
  ApiError,
} from "../api/client";

import {
  useAuth,
} from "../context/AuthContext";


type LoginProps = {
  onShowRegister: () => void;
  onForgotPassword: () => void;
};


export default function Login({
  onShowRegister,
  onForgotPassword,
}: LoginProps) {
  const {
    login,
  } = useAuth();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    developmentUrl,
    setDevelopmentUrl,
  ] = useState("");

  const [
    canResendVerification,
    setCanResendVerification,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    isResending,
    setIsResending,
  ] = useState(false);


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");
    setDevelopmentUrl("");
    setCanResendVerification(
      false,
    );
    setIsSubmitting(true);

    try {
      await login({
        email:
          email
            .trim()
            .toLowerCase(),
        password,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to sign in.",
      );

      if (
        caughtError instanceof
          ApiError &&
        caughtError.status === 403 &&
        caughtError.message
          .toLowerCase()
          .includes("not verified")
      ) {
        setCanResendVerification(
          true,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }


  async function resendVerification():
  Promise<void> {
    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (!normalizedEmail) {
      setError(
        "Enter your email address first.",
      );

      return;
    }

    setError("");
    setMessage("");
    setDevelopmentUrl("");
    setIsResending(true);

    try {
      const response =
        await requestEmailVerification(
          normalizedEmail,
        );

      setMessage(
        response.message,
      );

      setDevelopmentUrl(
        response.development_url ??
          "",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to request verification.",
      );
    } finally {
      setIsResending(false);
    }
  }


  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <div className="brand-icon">
            <CheckCircle2 size={26} />
          </div>

          <div>
            <h1>Chorevera</h1>
            <p>
              Build better daily routines.
            </p>
          </div>
        </div>

        <div className="auth-brand-copy">
          <span className="eyebrow">
            Welcome back
          </span>

          <h2>
            Stay organized and keep your
            routine moving.
          </h2>

          <p>
            Sign in to manage chores,
            reminders, progress, streaks,
            billing, and household activity.
          </p>
        </div>
      </section>

      <section className="auth-form-panel">
        <form
          className="auth-form-card"
          onSubmit={
            handleSubmit
          }
        >
          <div className="auth-form-heading">
            <div className="auth-form-icon">
              <LogIn size={24} />
            </div>

            <span className="eyebrow">
              Account access
            </span>

            <h2>
              Sign in to Chorevera
            </h2>

            <p>
              Enter your verified account
              email and password.
            </p>
          </div>

          <label className="auth-field">
            Email address

            <div className="auth-input-wrapper">
              <Mail size={18} />

              <input
                autoComplete="email"
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
          </label>

          <label className="auth-field">
            Password

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
                autoComplete="current-password"
                minLength={8}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                required
                type="password"
                value={password}
              />
            </div>
          </label>

          <div className="auth-inline-action">
            <button
              onClick={
                onForgotPassword
              }
              type="button"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div
              className="auth-message error"
              role="alert"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              className="auth-message success"
              role="status"
            >
              {message}
            </div>
          )}

          {developmentUrl && (
            <a
              className="auth-development-link"
              href={developmentUrl}
            >
              Open development verification link
            </a>
          )}

          {canResendVerification && (
            <button
              className="secondary-button auth-secondary-submit"
              disabled={
                isResending
              }
              onClick={() => {
                void resendVerification();
              }}
              type="button"
            >
              <Send size={18} />

              {isResending
                ? "Sending..."
                : "Resend verification email"}
            </button>
          )}

          <button
            className="primary-button auth-submit-button"
            disabled={
              isSubmitting
            }
            type="submit"
          >
            <LogIn size={19} />

            {isSubmitting
              ? "Signing in..."
              : "Sign in"}
          </button>

          <p className="auth-switch-text">
            Donâ€™t have an account?

            <button
              onClick={
                onShowRegister
              }
              type="button"
            >
              Create one
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}

