import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { OrderStatusBadge } from "../../entities/order/OrderStatusBadge";
import { formatCurrency } from "../../lib/format";
import { adminApi } from "./admin.api";
import type { AdminAnalytics } from "./admin.types";
import { SalesChart } from "./SalesChart";

export function AdminAnalyticsPage() {
  const [range, setRange] = useState({ from: "", to: "" });
  const [query, setQuery] = useState(range);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi
      .analytics(query.from, query.to, controller.signal)
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
  async function download() {
    setExporting(true);
    setError(null);
    try {
      const file = await adminApi.salesCsv(query.from, query.to);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setExporting(false);
    }
  }
  if (!data && !error)
    return <PageLoader label="Loading marketplace analytics" />;
  return (
    <section className="admin-section">
      <header className="admin-section-heading analytics-heading">
        <div>
          <span className="eyebrow">Authoritative snapshots</span>
          <h2>Marketplace analytics</h2>
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
          <button
            type="button"
            className="button button-primary"
            disabled={exporting}
            onClick={() => void download()}
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </form>
      </header>
      {error && <ErrorState message={error} />}
      {data && (
        <>
          <div className="admin-metrics">
            {data.financials.length === 0 ? (
              <EmptyState title="No marketplace sales">
                No persisted Orders exist for this period.
              </EmptyState>
            ) : (
              data.financials.map((metric) => (
                <article key={metric.currency}>
                  <span>Total net sales</span>
                  <strong>
                    {formatCurrency(metric.totalRevenue, metric.currency)}
                  </strong>
                  <small>
                    {metric.orderCount} Orders ·{" "}
                    {formatCurrency(metric.refundedGross, metric.currency)}{" "}
                    refunded
                  </small>
                  <div>
                    <span>
                      Platform{" "}
                      {formatCurrency(metric.platformRevenue, metric.currency)}
                    </span>
                    <span>
                      Sellers{" "}
                      {formatCurrency(metric.sellerRevenue, metric.currency)}
                    </span>
                  </div>
                </article>
              ))
            )}
            <article>
              <span>Cart to Order conversion</span>
              <strong>
                {data.conversion.ratePercent === null
                  ? "n/a"
                  : `${data.conversion.ratePercent}%`}
              </strong>
              <small>
                {data.conversion.successfulAttempts} successful of{" "}
                {data.conversion.totalAttempts} unique checkout attempts
              </small>
              <div>
                <span>{data.conversion.failedAttempts} failed</span>
                <span>{data.conversion.processingAttempts} processing</span>
              </div>
            </article>
          </div>
          <section className="chart-panel">
            <header>
              <div>
                <span className="eyebrow">UTC daily series</span>
                <h3>Net sales</h3>
              </div>
              <div className="comparison-list">
                {data.periodComparison.map((row) => (
                  <span key={row.currency}>
                    {row.currency}{" "}
                    <strong
                      className={
                        Number(row.delta) >= 0 ? "positive" : "negative"
                      }
                    >
                      {row.percentChange === null
                        ? "n/a"
                        : `${Number(row.delta) >= 0 ? "+" : ""}${row.percentChange}%`}
                    </strong>
                  </span>
                ))}
              </div>
            </header>
            <SalesChart rows={data.dailySales} />
          </section>
          <div className="analytics-rankings">
            <section>
              <span className="eyebrow">Purchase snapshots</span>
              <h3>Top Products</h3>
              <ol>
                {data.topProducts.map((item) => (
                  <li key={`${item.productId}-${item.currency}`}>
                    <div>
                      <strong>{item.productTitle}</strong>
                      <small>{item.netUnits} net units</small>
                    </div>
                    <strong>
                      {formatCurrency(item.netGross, item.currency)}
                    </strong>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <span className="eyebrow">Recognized ledger revenue</span>
              <h3>Top Sellers</h3>
              <ol>
                {data.topSellers.map((item) => (
                  <li key={`${item.sellerId}-${item.currency}`}>
                    <strong>{item.sellerName}</strong>
                    <strong>
                      {formatCurrency(item.recognizedRevenue, item.currency)}
                    </strong>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <span className="eyebrow">Order states</span>
              <h3>Status summary</h3>
              <div className="admin-status-list">
                {data.orderStatusSummary.map((item) => (
                  <div key={`${item.currency}-${item.status}`}>
                    <OrderStatusBadge status={item.status} />
                    <strong>{item.count}</strong>
                    <small>{item.currency}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <p className="analytics-definition">
            Total revenue uses persisted Order totals minus refunds. Platform
            and Seller revenue use ledger credits minus debits. Conversion is
            successful unique checkout attempts divided by all unique checkout
            attempts created in the selected period; idempotent retries count
            once.
          </p>
        </>
      )}
    </section>
  );
}
