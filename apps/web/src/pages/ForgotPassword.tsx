import {
  type FormEvent,
  useState,
} from "react";

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Mail,
  Send,
} from "lucide-react";

import {
  requestPasswordReset,
} from "../api/auth";


type ForgotPasswordProps = {
  onShowLogin: () => void;
};


export default function ForgotPassword({
  onShowLogin,
}: ForgotPasswordProps) {
  const [
    email,
    setEmail,
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
    setDevelopmentUrl("");
    setIsSubmitting(true);

    try {
      const response =
        await requestPasswordReset(
          email
            .trim()
            .toLowerCase(),
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
          : "Unable to request a password reset.",
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
            <h1>Chorevera</h1>

            <p>
              Build better daily routines.
            </p>
          </div>
        </div>

        <div className="auth-brand-copy">
          <span className="eyebrow">
            Account recovery
          </span>

          <h2>
            Reset your password securely.
          </h2>

          <p>
            Chorevera uses a short-lived,
            one-time link to protect your
            account.
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
              Forgot password
            </span>

            <h2>
              Request a reset link
            </h2>

            <p>
              Enter your account email. The
              response is intentionally the same
              whether or not an account exists.
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
              Open development reset link
            </a>
          )}

          <button
            className="primary-button auth-submit-button"
            disabled={
              isSubmitting
            }
            type="submit"
          >
            <Send size={19} />

            {isSubmitting
              ? "Sending..."
              : "Send reset link"}
          </button>

          <button
            className="auth-back-button"
            onClick={
              onShowLogin
            }
            type="button"
          >
            <ArrowLeft size={17} />
            Back to sign in
          </button>
        </form>
      </section>
    </main>
  );
}

