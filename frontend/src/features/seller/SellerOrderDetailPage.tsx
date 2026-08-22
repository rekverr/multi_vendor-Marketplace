import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, errorMessage } from "../../api/api-error";
import { ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { OrderStatusBadge } from "../../entities/order/OrderStatusBadge";
import type { SellerOrderStatus } from "../../entities/order/order.types";
import { formatCurrency, formatDate } from "../../lib/format";
import { sellerApi } from "./seller.api";
import type { SellerOrder } from "./seller.types";

const NEXT: Partial<Record<SellerOrderStatus, SellerOrderStatus>> = {
  NEW: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "COMPLETED",
};
export function SellerOrderDetailPage() {
  const { sellerOrderId = "" } = useParams();
  const [order, setOrder] = useState<SellerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void sellerApi
      .order(sellerOrderId, controller.signal)
      .then(setOrder)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [sellerOrderId]);
  async function advance() {
    if (!order || !NEXT[order.status]) return;
    setPending(true);
    setError(null);
    try {
      setOrder(await sellerApi.transitionOrder(order.id, NEXT[order.status]!));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? `Status conflict: ${requestError.message}`
          : requestError instanceof ApiError && requestError.status === 403
            ? "Forbidden: this SellerOrder is not available to the authenticated Seller."
            : errorMessage(requestError),
      );
    } finally {
      setPending(false);
    }
  }
  if (!order && !error) return <PageLoader label="Loading SellerOrder" />;
  if (!order)
    return (
      <main className="seller-section">
        <ErrorState message={error ?? "SellerOrder not found"} />
      </main>
    );
  const next = NEXT[order.status];
  return (
    <section className="seller-section">
      <Link className="back-link" to="/seller/orders">
        ← SellerOrders
      </Link>
      <header className="order-detail-heading">
        <div>
          <span className="eyebrow">SellerOrder {order.id.slice(0, 8)}</span>
          <h2>Fulfilment detail</h2>
          <p>Parent Order {order.orderId}</p>
        </div>
        <div className="order-heading-status">
          <OrderStatusBadge status={order.status} />
          {next && (
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() => void advance()}
            >
              {pending ? "Updating..." : `Mark ${next.replace("_", " ")}`}
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="seller-notice error-notice" role="alert">
          {error}
        </div>
      )}
      <div className="order-summary-bar">
        <div>
          <span>Gross</span>
          <strong>{formatCurrency(order.grossAmount, order.currency)}</strong>
        </div>
        <div>
          <span>Commission</span>
          <strong>
            {formatCurrency(order.platformCommission, order.currency)}
          </strong>
        </div>
        <div>
          <span>Seller net</span>
          <strong>{formatCurrency(order.sellerNet, order.currency)}</strong>
        </div>
        <small>Created {formatDate(order.createdAt)}</small>
      </div>
      <div className="seller-order-card">
        <header>
          <div>
            <span className="eyebrow">Immutable purchase snapshots</span>
            <h3>Order items</h3>
          </div>
        </header>
        {order.items.map((item) => (
          <article className="order-item-row" key={item.id}>
            <div className="order-item-image">
              {item.productImageUrl ? (
                <img src={item.productImageUrl} alt="" />
              ) : (
                item.productTitle.slice(0, 1)
              )}
            </div>
            <div>
              <strong>{item.productTitle}</strong>
              <span>
                {item.quantity} ×{" "}
                {formatCurrency(item.unitPrice, order.currency)}
              </span>
              <small>
                Cancelled {item.cancelledQuantity} · Refunded{" "}
                {item.refundedQuantity}
              </small>
            </div>
            <strong>{formatCurrency(item.lineTotal, order.currency)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
