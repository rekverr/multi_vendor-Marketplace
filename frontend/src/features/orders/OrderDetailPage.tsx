import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import { ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { OrderStatusBadge } from "../../entities/order/OrderStatusBadge";
import type {
  CustomerOrder,
  CustomerOrderItem,
  CustomerSellerOrder,
  Dispute,
} from "../../entities/order/order.types";
import { formatCurrency, formatDate } from "../../lib/format";
import { useOrderRealtime } from "../../realtime/useOrderRealtime";
import { DisputeForm } from "./DisputeForm";
import { ordersApi } from "./orders.api";

export function OrderDetailPage() {
  const { orderId = "" } = useParams();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void ordersApi
      .detail(orderId, controller.signal)
      .then((result) => {
        setOrder(result);
        setFailure(null);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setFailure(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [orderId, retry]);

  if (failure)
    return (
      <main className="order-detail-page">
        <ErrorState
          message={failure}
          onRetry={() => setRetry((value) => value + 1)}
        />
      </main>
    );
  if (!order || order.id !== orderId)
    return <PageLoader label="Loading Order" />;
  return <OrderDetailContent order={order} onOrder={setOrder} />;
}

function OrderDetailContent({
  order,
  onOrder,
}: {
  order: CustomerOrder;
  onOrder: (order: CustomerOrder) => void;
}) {
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(order.updatedAt);

  async function refresh(): Promise<void> {
    const current = await ordersApi.detail(order.id);
    onOrder(current);
    setLastSyncedAt(current.updatedAt);
    setOperationError(null);
  }

  const connection = useOrderRealtime(
    order.id,
    order.sellerOrders.map((sellerOrder) => sellerOrder.id),
    refresh,
  );
  const allCancellable =
    order.sellerOrders.length > 0 &&
    order.sellerOrders.every((sellerOrder) =>
      isCancellable(sellerOrder.status),
    );

  async function run(operation: () => Promise<unknown>): Promise<void> {
    setOperating(true);
    setOperationError(null);
    try {
      await operation();
      await refresh();
    } catch (requestError) {
      setOperationError(errorMessage(requestError));
    } finally {
      setOperating(false);
    }
  }

  return (
    <main className="order-detail-page">
      <Link className="back-link" to="/orders">
        ← All Orders
      </Link>
      <header className="order-detail-heading">
        <div>
          <span className="eyebrow">Order #{order.id.slice(0, 8)}</span>
          <h1>Order detail.</h1>
          <p>Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="order-heading-status">
          <OrderStatusBadge status={order.status} />
          <RealtimeIndicator connection={connection} />
          <button
            className="text-button"
            disabled={operating}
            onClick={() =>
              void refresh().catch((requestError: unknown) =>
                setOperationError(errorMessage(requestError)),
              )
            }
          >
            Refresh
          </button>
        </div>
      </header>
      {connection !== "connected" && (
        <div className="realtime-notice">
          Live updates are {connection}. API data remains available; the Order
          will resync after reconnect.
        </div>
      )}
      {operationError && (
        <div className="checkout-alert" role="alert">
          <strong>Order action failed</strong>
          <span>{operationError}</span>
          <button onClick={() => setOperationError(null)}>Dismiss</button>
        </div>
      )}
      <section className="order-summary-bar">
        <div>
          <span>Order total</span>
          <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
        </div>
        <div>
          <span>Refunded</span>
          <strong>
            {formatCurrency(order.refundedAmount, order.currency)}
          </strong>
        </div>
        <div>
          <span>Seller shipments</span>
          <strong>{order.sellerOrders.length}</strong>
        </div>
        <small>Synced {formatDate(lastSyncedAt)}</small>
      </section>
      {allCancellable && (
        <div className="order-action-bar">
          <div>
            <strong>Plans changed?</strong>
            <span>
              Cancellation is revalidated by the backend and applies atomically.
            </span>
          </div>
          <button
            className="button button-secondary"
            disabled={operating}
            onClick={() => {
              if (
                window.confirm(
                  "Cancel the entire Order? Inventory and financial state will be updated by the server.",
                )
              )
                void run(() => ordersApi.cancel(order.id));
            }}
          >
            Cancel entire Order
          </button>
        </div>
      )}
      <div className="seller-order-list">
        {order.sellerOrders.map((sellerOrder) => (
          <SellerOrderCard
            key={sellerOrder.id}
            order={order}
            sellerOrder={sellerOrder}
            operating={operating}
            disputedScopes={
              new Set(
                disputes.map(
                  (dispute) => dispute.orderItemId ?? dispute.sellerOrderId,
                ),
              )
            }
            onCancel={() =>
              void run(() =>
                ordersApi.cancelSellerOrder(order.id, sellerOrder.id),
              )
            }
            onDispute={(dispute) =>
              setDisputes((current) => [...current, dispute])
            }
          />
        ))}
      </div>
    </main>
  );
}

function SellerOrderCard({
  order,
  sellerOrder,
  operating,
  disputedScopes,
  onCancel,
  onDispute,
}: {
  order: CustomerOrder;
  sellerOrder: CustomerSellerOrder;
  operating: boolean;
  disputedScopes: Set<string>;
  onCancel: () => void;
  onDispute: (dispute: Dispute) => void;
}) {
  const disputeEligible = [
    "PROCESSING",
    "SHIPPED",
    "COMPLETED",
    "PARTIALLY_CANCELLED",
  ].includes(sellerOrder.status);
  return (
    <article className="seller-order-card">
      <header>
        <div>
          <span>Seller shipment</span>
          <h2>{sellerOrder.seller.displayName}</h2>
        </div>
        <div>
          <OrderStatusBadge status={sellerOrder.status} />
          <strong>
            {formatCurrency(sellerOrder.grossAmount, sellerOrder.currency)}
          </strong>
        </div>
      </header>
      <div className="order-items">
        {sellerOrder.items.map((item) => (
          <OrderItemRow
            key={item.id}
            item={item}
            currency={sellerOrder.currency}
            dispute={
              disputeEligible && !disputedScopes.has(item.id) ? (
                <DisputeForm
                  orderId={order.id}
                  sellerOrderId={sellerOrder.id}
                  orderItemId={item.id}
                  label="Report item issue"
                  onCreated={onDispute}
                />
              ) : null
            }
          />
        ))}
      </div>
      <footer>
        <div>
          {sellerOrder.completedAt && (
            <span>Completed {formatDate(sellerOrder.completedAt)}</span>
          )}
          {disputeEligible && !disputedScopes.has(sellerOrder.id) && (
            <DisputeForm
              orderId={order.id}
              sellerOrderId={sellerOrder.id}
              label="Open shipment dispute"
              onCreated={onDispute}
            />
          )}
        </div>
        {isCancellable(sellerOrder.status) && (
          <button
            className="button button-secondary"
            disabled={operating}
            onClick={() => {
              if (
                window.confirm(
                  `Cancel the shipment from ${sellerOrder.seller.displayName}?`,
                )
              )
                onCancel();
            }}
          >
            Cancel shipment
          </button>
        )}
      </footer>
    </article>
  );
}

function OrderItemRow({
  item,
  currency,
  dispute,
}: {
  item: CustomerOrderItem;
  currency: string;
  dispute: React.ReactNode;
}) {
  const activeQuantity = item.quantity - item.cancelledQuantity;
  return (
    <div className="order-item-row">
      <Link className="order-item-image" to={`/products/${item.productId}`}>
        {item.productImageUrl ? (
          <img src={item.productImageUrl} alt="" />
        ) : (
          item.productTitle.slice(0, 1)
        )}
      </Link>
      <div>
        <Link to={`/products/${item.productId}`}>{item.productTitle}</Link>
        <span>
          {formatCurrency(item.unitPrice, currency)} × {item.quantity}
        </span>
        {item.cancelledQuantity > 0 && (
          <small>{item.cancelledQuantity} cancelled</small>
        )}
        {item.refundedQuantity > 0 && (
          <small>
            {item.refundedQuantity} refunded ·{" "}
            {formatCurrency(item.refundedAmount, currency)}
          </small>
        )}
        {item.refundedQuantity < activeQuantity && (
          <small>
            Refund requests are processed by the Seller after completion.
          </small>
        )}
        {dispute}
      </div>
      <strong>{formatCurrency(item.lineTotal, currency)}</strong>
    </div>
  );
}

function RealtimeIndicator({
  connection,
}: {
  connection: "connecting" | "connected" | "disconnected";
}) {
  return (
    <span className={`realtime-indicator realtime-${connection}`}>
      <i />
      {connection === "connected"
        ? "Live"
        : connection === "connecting"
          ? "Connecting"
          : "Offline"}
    </span>
  );
}

function isCancellable(status: CustomerSellerOrder["status"]): boolean {
  return status === "NEW" || status === "PROCESSING";
}
