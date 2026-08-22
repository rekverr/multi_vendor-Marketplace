import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import { ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import type { PublicAuction } from "../../entities/product/product.types";
import { StockBadge } from "../../entities/product/StockBadge";
import { formatDate, formatMoney } from "../../lib/format";
import type { RealtimeConnection } from "../../realtime/realtime.types";
import { useAuctionRealtime } from "../../realtime/useAuctionRealtime";
import { ReviewsPanel } from "../catalog/ReviewsPanel";
import { auctionsApi } from "./auctions.api";
import { BidForm } from "./BidForm";

export function AuctionDetailPage() {
  const { auctionId = "" } = useParams();
  const [auction, setAuction] = useState<PublicAuction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  async function refresh(): Promise<void> {
    const current = await auctionsApi.detail(auctionId);
    setAuction(current);
    setError(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    void auctionsApi
      .detail(auctionId, controller.signal)
      .then((current) => {
        setAuction(current);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [auctionId, reload]);

  if (error)
    return (
      <main className="detail-page">
        <ErrorState
          message={error}
          onRetry={() => setReload((value) => value + 1)}
        />
      </main>
    );
  if (!auction || auction.id !== auctionId)
    return <PageLoader label="Loading auction" />;
  return <AuctionContent auction={auction} onRefresh={refresh} />;
}

function AuctionContent({
  auction,
  onRefresh,
}: {
  auction: PublicAuction;
  onRefresh: () => Promise<void>;
}) {
  const now = useClock();
  const deadlinePassed = now > 0 && now >= new Date(auction.endsAt).getTime();
  const [syncError, setSyncError] = useState<string | null>(null);
  const connection = useAuctionRealtime(auction.id, onRefresh);
  const displayPrice =
    auction.currentHighestBid?.amount ?? auction.startingPrice;

  useEffect(() => {
    if (!deadlinePassed || terminal(auction.status)) return;
    const timer = window.setTimeout(() => {
      void onRefresh()
        .then(() => setSyncError(null))
        .catch((requestError: unknown) =>
          setSyncError(errorMessage(requestError)),
        );
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [auction.status, auction.updatedAt, deadlinePassed, onRefresh]);

  return (
    <main className="detail-page auction-page">
      <Link className="back-link" to={`/products/${auction.product.id}`}>
        ← Product details
      </Link>
      <div className="auction-live-bar">
        <RealtimeIndicator connection={connection} />
        {syncError && (
          <span>Live resync failed. Use refresh to reconcile.</span>
        )}
        <button
          className="text-button"
          onClick={() =>
            void onRefresh().catch((requestError: unknown) =>
              setSyncError(errorMessage(requestError)),
            )
          }
        >
          Refresh state
        </button>
      </div>
      <section className="auction-hero">
        <div className="auction-image">
          {auction.product.imageUrl ? (
            <img src={auction.product.imageUrl} alt={auction.product.title} />
          ) : (
            <span>{auction.product.title.slice(0, 1)}</span>
          )}
          <span className="auction-status">{auction.status}</span>
        </div>
        <div className="auction-copy">
          <span className="eyebrow">Live marketplace auction</span>
          <h1>{auction.product.title}</h1>
          <p>{auction.product.description}</p>
          <div className="auction-price">
            <span>
              {auction.currentHighestBid
                ? "Current highest bid"
                : "Starting price"}
            </span>
            <strong>{formatMoney(displayPrice)}</strong>
            <small>
              {auction.bidCount} accepted{" "}
              {auction.bidCount === 1 ? "bid" : "bids"}
            </small>
          </div>
          <Countdown
            startsAt={auction.startsAt}
            endsAt={auction.endsAt}
            status={auction.status}
            now={now}
          />
          <div className="auction-facts">
            <span>
              Minimum increment{" "}
              <strong>{formatMoney(auction.minimumIncrement)}</strong>
            </span>
            <span>
              Seller <strong>{auction.product.seller.displayName}</strong>
            </span>
            <StockBadge stock={auction.product.stock} />
          </div>
          <p className="authority-note">
            Displayed timing is informational. The backend decides whether the
            Auction is active and whether a bid is valid.
          </p>
        </div>
      </section>
      <BidForm
        auction={auction}
        deadlinePassed={deadlinePassed}
        onAccepted={async () => {
          await onRefresh();
        }}
      />
      <WinnerState auction={auction} now={now} />
      <section className="bid-history">
        <header>
          <div>
            <span className="eyebrow">Accepted bids</span>
            <h2>Bid history</h2>
          </div>
          <span>
            Showing {auction.bids.length} of {auction.bidCount}
          </span>
        </header>
        {auction.bids.length === 0 ? (
          <p className="review-empty">No accepted bids yet.</p>
        ) : (
          <ol>
            {auction.bids.map((bid, index) => (
              <li key={bid.id}>
                <span>#{auction.bidCount - index}</span>
                <strong>{formatMoney(bid.amount)}</strong>
                <time dateTime={bid.createdAt}>
                  {formatDate(bid.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
      <ReviewsPanel productId={auction.product.id} />
    </main>
  );
}

function Countdown({
  startsAt,
  endsAt,
  status,
  now,
}: {
  startsAt: string;
  endsAt: string;
  status: PublicAuction["status"];
  now: number;
}) {
  if (now === 0)
    return (
      <div className="countdown">
        <span>Synchronizing countdown</span>
      </div>
    );
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const waiting = now < start;
  const remaining = Math.max(0, (waiting ? start : end) - now);
  const seconds = Math.floor(remaining / 1000);
  const parts = [
    Math.floor(seconds / 86400),
    Math.floor((seconds % 86400) / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ];
  const closed = terminal(status) || now >= end;
  return (
    <div className={`countdown ${closed ? "countdown-ended" : ""}`}>
      <span>
        {closed
          ? terminal(status)
            ? "Auction closed"
            : "Deadline passed · awaiting server finalization"
          : waiting
            ? "Starts in"
            : "Time remaining"}
      </span>
      {closed ? (
        <strong>{terminal(status) ? status : "FINALIZING"}</strong>
      ) : (
        <div>
          {parts.map((part, index) => (
            <span key={["days", "hours", "minutes", "seconds"][index]}>
              <strong>{String(part).padStart(2, "0")}</strong>
              <small>{["days", "hours", "min", "sec"][index]}</small>
            </span>
          ))}
        </div>
      )}
      <time dateTime={waiting ? startsAt : endsAt}>
        {waiting
          ? `Starts ${formatDate(startsAt)}`
          : `Ends ${formatDate(endsAt)}`}
      </time>
    </div>
  );
}

function WinnerState({
  auction,
  now,
}: {
  auction: PublicAuction;
  now: number;
}) {
  if (auction.status === "UNSOLD")
    return (
      <section className="winner-state">
        <span className="eyebrow">Auction result</span>
        <h2>No winning bid</h2>
        <p>This Auction finalized without a winner.</p>
      </section>
    );
  if (auction.status !== "SOLD") return null;
  const expires = auction.winnerCheckoutExpiresAt
    ? new Date(auction.winnerCheckoutExpiresAt).getTime()
    : null;
  const expired = expires !== null && now > 0 && now >= expires;
  return (
    <section className="winner-state">
      <span className="eyebrow">Auction result</span>
      <h2>Sold for {formatMoney(auction.winningPrice)}</h2>
      {auction.winnerCheckoutExpiresAt && (
        <p>
          {expired
            ? "The published winner purchase window has expired."
            : `The winning bidder purchase window ends ${formatDate(auction.winnerCheckoutExpiresAt)}.`}
        </p>
      )}
      <small>
        The public API does not expose winner identity. Purchase eligibility
        must be verified by the backend.
      </small>
    </section>
  );
}

function RealtimeIndicator({ connection }: { connection: RealtimeConnection }) {
  return (
    <span className={`realtime-indicator realtime-${connection}`}>
      <i />
      {connection === "connected"
        ? "Live bids"
        : connection === "connecting"
          ? "Connecting"
          : "Offline"}
    </span>
  );
}
function useClock(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);
  return now;
}
function terminal(status: PublicAuction["status"]): boolean {
  return ["ENDED", "SOLD", "UNSOLD", "CANCELLED"].includes(status);
}
