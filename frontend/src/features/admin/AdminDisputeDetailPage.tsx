import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, errorMessage } from "../../api/api-error";
import { ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { formatDate } from "../../lib/format";
import { adminApi } from "./admin.api";
import type { AdminDispute, DisputeStatus } from "./admin.types";
import { ConfirmDialog } from "./ConfirmDialog";

const NEXT: Record<DisputeStatus, DisputeStatus[]> = {
  OPEN: ["UNDER_REVIEW", "RESOLVED", "REJECTED"],
  UNDER_REVIEW: ["RESOLVED", "REJECTED"],
  RESOLVED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

export function AdminDisputeDetailPage() {
  const { disputeId = "" } = useParams();
  const [item, setItem] = useState<AdminDispute | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi
      .dispute(disputeId, controller.signal)
      .then(setItem)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [disputeId]);
  async function transition(status: DisputeStatus, note: string) {
    setError(null);
    try {
      setItem(
        await adminApi.transitionDispute(disputeId, status, note || undefined),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? `Transition conflict: ${requestError.message}`
          : errorMessage(requestError),
      );
      throw requestError;
    }
  }
  if (!item && !error) return <PageLoader label="Loading dispute" />;
  if (!item) return <ErrorState message={error ?? "Dispute not found"} />;
  return (
    <section className="admin-section">
      <Link className="back-link" to="/admin/disputes">
        ← Disputes
      </Link>
      <header className="admin-section-heading">
        <div>
          <span className="eyebrow">Dispute {item.id.slice(0, 8)}</span>
          <h2>{item.orderItem?.productTitle ?? "SellerOrder dispute"}</h2>
        </div>
        <span className={`admin-status status-${item.status.toLowerCase()}`}>
          {item.status.replace("_", " ")}
        </span>
      </header>
      {error && <ErrorState message={error} />}
      <div className="dispute-record">
        <div>
          <span>Customer</span>
          <strong>{item.customerId}</strong>
        </div>
        <div>
          <span>Seller</span>
          <strong>{item.sellerOrder.sellerId}</strong>
        </div>
        <div>
          <span>Order</span>
          <strong>{item.orderId}</strong>
        </div>
        <div>
          <span>Opened</span>
          <strong>{formatDate(item.createdAt)}</strong>
        </div>
        <article>
          <span>Customer reason</span>
          <p>{item.reason}</p>
        </article>
        {item.orderItem && (
          <article>
            <span>Purchase snapshot</span>
            <p>
              {item.orderItem.quantity} × {item.orderItem.unitPrice}; persisted
              line amount {item.orderItem.lineTotal}. Currency is not exposed by
              this response.
            </p>
          </article>
        )}
        {item.resolutionNote && (
          <article>
            <span>Resolution</span>
            <p>{item.resolutionNote}</p>
          </article>
        )}
      </div>
      <div className="moderation-actions">
        {NEXT[item.status].map((status) => (
          <ConfirmDialog
            key={status}
            title={`Move dispute to ${status.replace("_", " ")}?`}
            description="This transition is persisted and emitted through the transactional Outbox."
            confirmLabel={`Confirm ${status.replace("_", " ")}`}
            requireText={status === "RESOLVED" || status === "REJECTED"}
            onConfirm={(note) => transition(status, note)}
          >
            <button
              className={`button ${status === "REJECTED" ? "button-secondary" : "button-primary"}`}
            >
              {status.replace("_", " ")}
            </button>
          </ConfirmDialog>
        ))}
      </div>
    </section>
  );
}
