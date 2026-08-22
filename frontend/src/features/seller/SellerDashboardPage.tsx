import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { OrderStatusBadge } from "../../entities/order/OrderStatusBadge";
import { formatCurrency, formatDate } from "../../lib/format";
import { sellerApi } from "./seller.api";
import type { SellerDashboard } from "./seller.types";

export function SellerDashboardPage() {
  const [range, setRange] = useState({ from: "", to: "" });
  const [query, setQuery] = useState(range);
  const [data, setData] = useState<SellerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void sellerApi
      .dashboard(query.from, query.to, controller.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [query]);
  function filter(event: FormEvent) {
    event.preventDefault();
    if (range.from && range.to && range.from > range.to) {
      setError("Range start must not exceed range end.");
      return;
    }
    setError(null);
    setQuery({ ...range });
  }
  if (!data && !error) return <PageLoader label="Loading Seller dashboard" />;
  return (
    <section className="seller-section">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Performance</span>
          <h2>{data?.seller.displayName ?? "Seller dashboard"}</h2>
        </div>
        <form className="date-filter" onSubmit={filter}>
          <label>
            From
            <input
              type="date"
              value={range.from}
              onChange={(event) =>
                setRange({ ...range, from: event.target.value })
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={range.to}
              onChange={(event) =>
                setRange({ ...range, to: event.target.value })
              }
            />
          </label>
          <button className="button button-secondary">Apply</button>
        </form>
      </header>
      {error && <ErrorState message={error} />}
      {data && (
        <>
          <div className="metric-grid">
            {data.financials.length === 0 ? (
              <EmptyState title="No sales in this period">
                Revenue appears after persisted Seller ledger entries are
                created.
              </EmptyState>
            ) : (
              data.financials.map((metric) => (
                <article key={metric.currency}>
                  <span>{metric.currency} recognized revenue</span>
                  <strong>
                    {formatCurrency(
                      metric.recognizedSellerRevenue,
                      metric.currency,
                    )}
                  </strong>
                  <small>
                    {metric.orderCount} orders ·{" "}
                    {formatCurrency(metric.refundedGross, metric.currency)}{" "}
                    refunded
                  </small>
                </article>
              ))
            )}
          </div>
          <div className="dashboard-grid">
            <section>
              <span className="eyebrow">Historical snapshots</span>
              <h3>Top Products</h3>
              {data.topProducts.length === 0 ? (
                <p className="muted-copy">No Product performance yet.</p>
              ) : (
                <ol className="performance-list">
                  {data.topProducts.map((product) => (
                    <li key={`${product.productId}-${product.currency}`}>
                      <div>
                        <strong>{product.productTitle}</strong>
                        <small>{product.netUnits} net units</small>
                      </div>
                      <strong>
                        {formatCurrency(product.netGross, product.currency)}
                      </strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section>
              <span className="eyebrow">Order states</span>
              <h3>Status summary</h3>
              <div className="status-summary">
                {data.orderStatusSummary.map((row) => (
                  <div key={`${row.currency}-${row.status}`}>
                    <OrderStatusBadge status={row.status} />
                    <strong>{row.count}</strong>
                    <small>{row.currency}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="recent-orders">
            <header>
              <div>
                <span className="eyebrow">Recent</span>
                <h3>SellerOrders</h3>
              </div>
              <Link className="text-button" to="/seller/orders">
                View all
              </Link>
            </header>
            {data.recentSellerOrders.map((order) => (
              <Link key={order.id} to={`/seller/orders/${order.id}`}>
                <OrderStatusBadge status={order.status} />
                <span>{order.itemCount} items</span>
                <strong>
                  {formatCurrency(order.grossAmount, order.currency)}
                </strong>
                <time>{formatDate(order.createdAt)}</time>
              </Link>
            ))}
          </section>
          <p className="analytics-definition">
            Recognized revenue uses persisted Seller ledger credits minus
            debits. Refunds and cancellations use ledger and purchase snapshots,
            never current Product prices.
          </p>
        </>
      )}
    </section>
  );
}
