import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import type {
  PublicAuction,
  PublicBid,
} from "../../entities/product/product.types";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../auth/AuthContext";
import { auctionsApi } from "./auctions.api";
import { clearBidAttempt, getBidAttempt } from "./bid-attempt";

const MONEY = /^(?!0(?:\.0{1,2})?$)(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;

export function BidForm({
  auction,
  deadlinePassed,
  onAccepted,
}: {
  auction: PublicAuction;
  deadlinePassed: boolean;
  onAccepted: (bid: PublicBid) => Promise<void>;
}) {
  const auth = useAuth();
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<PublicBid | null>(null);
  const closed =
    deadlinePassed ||
    ["ENDED", "SOLD", "UNSOLD", "CANCELLED"].includes(auction.status);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalized = amount.trim();
    if (!MONEY.test(normalized)) {
      setError("Enter a positive amount with no more than two decimal places.");
      return;
    }
    if (!auth.user || auth.user.role !== "CUSTOMER") return;
    setPending(true);
    setError(null);
    setSyncError(null);
    setAccepted(null);
    const attempt = getBidAttempt(auction.id, auth.user.id, normalized);
    try {
      const bid = await auctionsApi.bid(
        auction.id,
        normalized,
        attempt.idempotencyKey,
      );
      setAccepted(bid);
      clearBidAttempt();
      try {
        await onAccepted(bid);
      } catch {
        setSyncError(
          "The bid was accepted, but refreshing the Auction failed. Use Refresh state to reconcile.",
        );
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  }
  if (closed)
    return (
      <div className="bid-state bid-closed">
        <strong>Bidding is closed</strong>
        <span>The final Auction state is determined by the backend.</span>
      </div>
    );
  if (auth.status !== "authenticated")
    return (
      <div className="bid-state">
        <strong>Ready to bid?</strong>
        <span>
          Sign in with a Customer account to submit an authoritative bid.
        </span>
        <Link
          className="button button-primary"
          to="/login"
          state={{ from: `/auctions/${auction.id}` }}
        >
          Sign in
        </Link>
      </div>
    );
  if (auth.user?.role !== "CUSTOMER")
    return (
      <div className="bid-state">
        <strong>Customer account required</strong>
        <span>Seller and Admin accounts cannot place bids.</span>
      </div>
    );
  return (
    <form className="bid-form" onSubmit={submit}>
      <div>
        <span className="eyebrow">Place a bid</span>
        <h2>Your amount</h2>
        <p>
          The server validates the current highest bid, minimum increment,
          eligibility, and deadline at submission time.
        </p>
      </div>
      <label>
        <span>Bid amount</span>
        <div>
          <span>$</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setAccepted(null);
              setError(null);
              setSyncError(null);
            }}
            placeholder="0.00"
            aria-invalid={Boolean(error)}
          />
        </div>
      </label>
      <p className="bid-hint">
        Starting price {formatMoney(auction.startingPrice)} · Increment{" "}
        {formatMoney(auction.minimumIncrement)}
      </p>
      {error && (
        <div className="bid-message bid-rejected" role="alert">
          <strong>Bid not accepted</strong>
          <span>{error}</span>
          <small>
            The same amount can be retried safely after a network failure.
          </small>
        </div>
      )}
      {accepted && (
        <div className="bid-message bid-accepted" role="status">
          <strong>Bid accepted by the server</strong>
          <span>{formatMoney(accepted.amount)}</span>
        </div>
      )}
      {syncError && (
        <div className="bid-message bid-sync-warning" role="status">
          <strong>Refresh required</strong>
          <span>{syncError}</span>
        </div>
      )}
      <button
        className="button button-primary"
        disabled={pending || !MONEY.test(amount.trim())}
      >
        {pending ? "Submitting securely..." : "Submit bid"}
      </button>
    </form>
  );
}
