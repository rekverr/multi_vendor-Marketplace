import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, errorMessage } from "../../api/api-error";
import { PageLoader } from "../../components/PageLoader";
import { sellerApi } from "./seller.api";
import type { SellerAuction, SellerProduct } from "./seller.types";

const POSITIVE = /^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;
function localDate(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export function AuctionEditorPage() {
  const { productId = "" } = useParams();
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [auction, setAuction] = useState<SellerAuction | null>(null);
  const [form, setForm] = useState({
    startingPrice: "",
    minimumIncrement: "",
    startsAt: "",
    endsAt: "",
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void sellerApi
      .product(productId, controller.signal)
      .then(async (current) => {
        setProduct(current);
        try {
          const configured = await sellerApi.auction(
            productId,
            controller.signal,
          );
          setAuction(configured);
          setForm({
            startingPrice: configured.startingPrice,
            minimumIncrement: configured.minimumIncrement,
            startsAt: localDate(configured.startsAt),
            endsAt: localDate(configured.endsAt),
          });
        } catch (requestError) {
          if (
            !(requestError instanceof ApiError && requestError.status === 404)
          )
            throw requestError;
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [productId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !POSITIVE.test(form.startingPrice) ||
      !POSITIVE.test(form.minimumIncrement)
    ) {
      setError(
        "Starting price and increment must be positive amounts with at most two decimals.",
      );
      return;
    }
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (
      !form.startsAt ||
      !form.endsAt ||
      startsAt <= new Date() ||
      endsAt.getTime() - startsAt.getTime() < 60000
    ) {
      setError(
        "Start must be in the future and end at least one minute later.",
      );
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const configured = await sellerApi.configureAuction(productId, {
        startingPrice: form.startingPrice,
        minimumIncrement: form.minimumIncrement,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      setAuction(configured);
      setSaved(true);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? `Auction conflict: ${requestError.message}`
          : errorMessage(requestError),
      );
    } finally {
      setPending(false);
    }
  }
  if (loading) return <PageLoader label="Loading Auction configuration" />;
  if (!product)
    return (
      <section className="seller-section">
        <ErrorStateCompat message={error ?? "Product not found"} />
      </section>
    );
  const immutable = Boolean(
    auction &&
    (auction.status !== "SCHEDULED" ||
      new Date(auction.startsAt) <= new Date() ||
      auction._count.bids > 0),
  );
  return (
    <section className="seller-section">
      <Link className="back-link" to={`/seller/products/${product.id}`}>
        ← Product
      </Link>
      <header className="section-heading">
        <div>
          <span className="eyebrow">Auction lot</span>
          <h2>{product.title}</h2>
        </div>
        {auction && (
          <span className="product-state">
            {auction.status} · {auction._count.bids} bids
          </span>
        )}
      </header>
      {product.type !== "AUCTION" && (
        <div className="seller-notice error-notice">
          A fixed-price Product cannot be configured for bidding.
        </div>
      )}
      {immutable && (
        <div className="seller-notice conflict-notice">
          Started Auction configuration is immutable. Backend lifecycle rules
          remain authoritative.
        </div>
      )}
      <form className="seller-form" onSubmit={submit}>
        <label>
          Starting price
          <input
            required
            inputMode="decimal"
            disabled={immutable || product.type !== "AUCTION"}
            value={form.startingPrice}
            onChange={(event) =>
              setForm({ ...form, startingPrice: event.target.value })
            }
          />
        </label>
        <label>
          Minimum increment
          <input
            required
            inputMode="decimal"
            disabled={immutable || product.type !== "AUCTION"}
            value={form.minimumIncrement}
            onChange={(event) =>
              setForm({ ...form, minimumIncrement: event.target.value })
            }
          />
        </label>
        <label>
          Starts at
          <input
            required
            type="datetime-local"
            disabled={immutable || product.type !== "AUCTION"}
            value={form.startsAt}
            onChange={(event) =>
              setForm({ ...form, startsAt: event.target.value })
            }
          />
        </label>
        <label>
          Ends at
          <input
            required
            type="datetime-local"
            disabled={immutable || product.type !== "AUCTION"}
            value={form.endsAt}
            onChange={(event) =>
              setForm({ ...form, endsAt: event.target.value })
            }
          />
        </label>
        {error && (
          <div className="seller-notice error-notice span-two" role="alert">
            {error}
          </div>
        )}
        {saved && (
          <div className="seller-notice success-notice span-two" role="status">
            Auction configuration saved by the server.
          </div>
        )}
        <div className="form-actions span-two">
          <button
            className="button button-primary"
            disabled={pending || immutable || product.type !== "AUCTION"}
          >
            {pending ? "Saving..." : "Save Auction"}
          </button>
        </div>
      </form>
    </section>
  );
}
function ErrorStateCompat({ message }: { message: string }) {
  return (
    <div className="seller-notice error-notice" role="alert">
      {message}
    </div>
  );
}
