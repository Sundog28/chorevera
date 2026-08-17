import {
  type FormEvent,
  useState,
} from "react";

import {
  CheckCircle2,
  LockKeyhole,
  Mail,
  UserPlus,
  UserRound,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";


type RegisterProps = {
  onShowLogin: () => void;
  onRegistered:
    (email: string) =>
      void;
};


export default function Register({
  onShowLogin,
  onRegistered,
}: RegisterProps) {
  const {
    register,
  } = useAuth();

  const [
    name,
    setName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

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
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "The passwords do not match.",
      );

      return;
    }

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    setIsSubmitting(true);

    try {
      await register({
        name:
          name.trim(),
        email:
          normalizedEmail,
        password,
      });

      onRegistered(
        normalizedEmail,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create your account.",
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
            Start your routine
          </span>

          <h2>
            Create an account and organize
            every day.
          </h2>

          <p>
            Verify your email to protect your
            chores, reminders, household, and
            subscription.
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
              <UserPlus size={24} />
            </div>

            <span className="eyebrow">
              New account
            </span>

            <h2>
              Create your Chorevera account
            </h2>

            <p>
              Chorevera will send a verification
              link before you can sign in.
            </p>
          </div>

          <label className="auth-field">
            Your name

            <div className="auth-input-wrapper">
              <UserRound size={18} />

              <input
                autoComplete="name"
                maxLength={100}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                placeholder="John Treen"
                required
                type="text"
                value={name}
              />
            </div>
          </label>

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
                autoComplete="new-password"
                minLength={8}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="At least 8 characters"
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

          <button
            className="primary-button auth-submit-button"
            disabled={
              isSubmitting
            }
            type="submit"
          >
            <UserPlus size={19} />

            {isSubmitting
              ? "Creating account..."
              : "Create account"}
          </button>

          <p className="auth-switch-text">
            Already have an account?

            <button
              onClick={
                onShowLogin
              }
              type="button"
            >
              Sign in
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}

