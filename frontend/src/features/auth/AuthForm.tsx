import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/api-error";

interface AuthFormProps {
  mode: "login" | "register";
  onSubmit: (input: { email: string; password: string }) => Promise<void>;
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegistration = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ email, password });
    } catch (submissionError) {
      setError(errorMessage(submissionError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {error && (
        <div className="form-alert" role="alert">
          {error}
        </div>
      )}
      <label>
        Email
        <input
          autoComplete="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          autoComplete={isRegistration ? "new-password" : "current-password"}
          type="password"
          minLength={isRegistration ? 12 : 1}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {isRegistration && (
          <span className="field-hint">Use at least 12 characters.</span>
        )}
      </label>
      <button
        className="button button-primary"
        disabled={submitting}
        type="submit"
      >
        {submitting
          ? "Please wait..."
          : isRegistration
            ? "Create account"
            : "Sign in"}
      </button>
      <p className="form-switch">
        {isRegistration ? "Already registered?" : "New to Marketline?"}{" "}
        <Link to={isRegistration ? "/login" : "/register"}>
          {isRegistration ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
