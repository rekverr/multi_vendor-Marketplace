import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { OrderStatusBadge } from "../../entities/order/OrderStatusBadge";
import { formatCurrency, formatDate } from "../../lib/format";
import { Pagination } from "../catalog/Pagination";
import { sellerApi } from "./seller.api";
import type { SellerOrdersResponse } from "./seller.types";

export function SellerOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [data, setData] = useState<SellerOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void sellerApi
      .orders(page, controller.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [page]);
  if (!data && !error) return <PageLoader label="Loading Seller orders" />;
  if (error) return <ErrorState message={error} />;
  return (
    <section className="seller-section">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Fulfilment</span>
          <h2>SellerOrders</h2>
        </div>
        <span>{data?.total ?? 0} total</span>
      </header>
      {data?.items.length === 0 ? (
        <EmptyState title="No SellerOrders">
          New Customer purchases will appear here.
        </EmptyState>
      ) : (
        <div className="seller-order-list">
          {data?.items.map((order) => (
            <Link to={`/seller/orders/${order.id}`} key={order.id}>
              <div>
                <span className="eyebrow">
                  Order {order.orderId.slice(0, 8)}
                </span>
                <strong>{order.items.length} line items</strong>
                <small>{formatDate(order.createdAt)}</small>
              </div>
              <OrderStatusBadge status={order.status} />
              <strong>
                {formatCurrency(order.grossAmount, order.currency)}
              </strong>
              <span>View →</span>
            </Link>
          ))}
        </div>
      )}
      {data && data.total > data.pageSize && (
        <Pagination
          page={page}
          totalPages={Math.ceil(data.total / data.pageSize)}
          onPage={(next) => setParams({ page: String(next) })}
        />
      )}
    </section>
  );
}
