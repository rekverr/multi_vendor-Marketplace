import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import { PageLoader } from "../../components/PageLoader";
import { useAuth } from "./AuthContext";

export function GoogleCallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const invalidResponse =
    searchParams.get("error") ||
    !searchParams.get("code") ||
    !searchParams.get("state");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) return;
    void auth
      .completeGoogleLogin(code, state)
      .then(() => navigate("/account", { replace: true }))
      .catch((callbackError: unknown) => setError(errorMessage(callbackError)));
  }, [auth, navigate, searchParams]);

  if (invalidResponse || error)
    return (
      <main className="status-page">
        <span className="eyebrow">Authentication failed</span>
        <h1>Google sign-in did not complete.</h1>
        <p>
          {error ??
            "Google sign-in was cancelled or returned an invalid response."}
        </p>
        <button
          className="button button-primary"
          onClick={() => navigate("/login")}
        >
          Return to sign in
        </button>
      </main>
    );
  return <PageLoader label="Completing Google sign-in" />;
}
