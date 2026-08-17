import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  MailCheck,
  Send,
} from "lucide-react";

import {
  confirmEmailVerification,
  requestEmailVerification,
} from "../api/auth";


type VerifyEmailProps = {
  token: string;
  email: string;
  onComplete: () => void;
};


function VerifyEmail({
  token,
  email: initialEmail,
  onComplete,
}: VerifyEmailProps) {
  const [
    email,
    setEmail,
  ] = useState(
    initialEmail,
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState(
    token
      ? "Verifying your email..."
      : (
          "Check your email for a verification link. "
          + "You can also request a new link below."
        ),
  );

  const [
    developmentUrl,
    setDevelopmentUrl,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(
    Boolean(token),
  );

  const [
    isVerified,
    setIsVerified,
  ] = useState(false);


  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;

    async function verify():
    Promise<void> {
      try {
        const response =
          await confirmEmailVerification(
            token,
          );

        if (!isMounted) {
          return;
        }

        setMessage(
          response.message,
        );

        setIsVerified(
          true,
        );
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to verify your email.",
        );

        setMessage("");
      } finally {
        if (isMounted) {
          setIsSubmitting(
            false,
          );
        }
      }
    }

    void verify();

    return () => {
      isMounted = false;
    };
  }, [token]);


  async function handleResend(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setDevelopmentUrl("");
    setIsSubmitting(true);

    try {
      const response =
        await requestEmailVerification(
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
          : "Unable to request verification.",
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
            Email protection
          </span>

          <h2>
            Verify that this email belongs
            to you.
          </h2>

          <p>
            Verification protects household,
            billing, and password-recovery
            features.
          </p>
        </div>
      </section>

      <section className="auth-form-panel">
        <form
          className="auth-form-card"
          onSubmit={
            handleResend
          }
        >
          <div className="auth-form-heading">
            <div className="auth-form-icon">
              <MailCheck size={24} />
            </div>

            <span className="eyebrow">
              Email verification
            </span>

            <h2>
              {isVerified
                ? "Email verified"
                : "Verify your email"}
            </h2>

            <p>
              {message}
            </p>
          </div>

          {error && (
            <div
              className="auth-message error"
              role="alert"
            >
              {error}
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

          {isVerified ? (
            <button
              className="primary-button auth-submit-button"
              onClick={
                onComplete
              }
              type="button"
            >
              Sign in
            </button>
          ) : (
            <>
              {!token && (
                <label className="auth-field">
                  Email address

                  <div className="auth-input-wrapper">
                    <MailCheck size={18} />

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
              )}

              {!token && (
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
                    : "Resend verification email"}
                </button>
              )}

              {token && isSubmitting && (
                <div className="auth-verifying-state">
                  <div className="loading-spinner" />
                  Verifying...
                </div>
              )}

              <button
                className="auth-back-button"
                onClick={
                  onComplete
                }
                type="button"
              >
                Back to sign in
              </button>
            </>
          )}
        </form>
      </section>
    </main>
  );
}


export default VerifyEmail;

