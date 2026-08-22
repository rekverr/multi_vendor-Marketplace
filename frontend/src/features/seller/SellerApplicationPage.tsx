import { useState, type FormEvent } from "react";
import { ApiError, errorMessage } from "../../api/api-error";
import { sellerApi } from "./seller.api";

export function SellerApplicationPage() {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (value.length < 2 || value.length > 100) {
      setError("Display name must contain 2 to 100 characters.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await sellerApi.apply(value);
      setResult(
        "Application submitted. An Admin must review it before Seller tools become available.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? "You already have an active Seller application."
          : errorMessage(requestError),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="form-page">
      <section className="seller-application">
        <span className="eyebrow">Become a Seller</span>
        <h1>Open your storefront.</h1>
        <p>
          Submission does not change your role. Marketplace Admin approval is
          required.
        </p>
        {result ? (
          <div className="seller-notice success-notice" role="status">
            {result}
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Public Seller name
              <input
                value={name}
                maxLength={100}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
              />
            </label>
            {error && (
              <div className="seller-notice error-notice" role="alert">
                {error}
              </div>
            )}
            <button className="button button-primary" disabled={pending}>
              {pending ? "Submitting..." : "Submit application"}
            </button>
          </form>
        )}
        <small>
          The backend currently exposes submission but not a Customer-facing
          application-status endpoint.
        </small>
      </section>
    </main>
  );
}
