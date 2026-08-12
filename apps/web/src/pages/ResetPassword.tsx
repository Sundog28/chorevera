import {
  type FormEvent,
  useState,
} from "react";

import {
  CheckCircle2,
  KeyRound,
  LockKeyhole,
} from "lucide-react";

import {
  confirmPasswordReset,
} from "../api/auth";


type ResetPasswordProps = {
  token: string;
  onComplete: () => void;
};


export default function ResetPassword({
  token,
  onComplete,
}: ResetPasswordProps) {
  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
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
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!token) {
      setError(
        "This reset link is missing its token.",
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "The passwords do not match.",
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        await confirmPasswordReset(
          token,
          password,
        );

      setMessage(
        response.message,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reset your password.",
      );
    } finally {
      setIsSubmitting(false);
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
            <h1>ChoreFlow</h1>

            <p>
              Build better daily routines.
            </p>
          </div>
        </div>

        <div className="auth-brand-copy">
          <span className="eyebrow">
            Secure reset
          </span>

          <h2>
            Choose a new password.
          </h2>

          <p>
            Using this link invalidates older
            password-reset links and active
            access tokens.
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
              <KeyRound size={24} />
            </div>

            <span className="eyebrow">
              Password reset
            </span>

            <h2>
              Create a new password
            </h2>

            <p>
              Use at least eight characters.
            </p>
          </div>

          <label className="auth-field">
            New password

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
                autoComplete="new-password"
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

          <label className="auth-field">
            Confirm password

            <div className="auth-input-wrapper">
              <LockKeyhole size={18} />

              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                required
                type="password"
                value={
                  confirmPassword
                }
              />
            </div>
          </label>

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

          {!message ? (
            <button
              className="primary-button auth-submit-button"
              disabled={
                isSubmitting
              }
              type="submit"
            >
              <KeyRound size={19} />

              {isSubmitting
                ? "Resetting..."
                : "Reset password"}
            </button>
          ) : (
            <button
              className="primary-button auth-submit-button"
              onClick={
                onComplete
              }
              type="button"
            >
              Sign in
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
