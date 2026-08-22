import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { OrderStatusBadge } from "../../entities/order/OrderStatusBadge";
import type { OrdersResponse } from "../../entities/order/order.types";
import { formatCurrency, formatDate } from "../../lib/format";
import { Pagination } from "../catalog/Pagination";
import { ordersApi } from "./orders.api";

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = positivePage(params.get("page"));
  const [response, setResponse] = useState<OrdersResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loadedPage, setLoadedPage] = useState(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void ordersApi
      .list(page, controller.signal)
      .then((result) => {
        setResponse(result);
        setFailure(null);
        setLoadedPage(page);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(errorMessage(requestError));
          setLoadedPage(page);
        }
      });
    return () => controller.abort();
  }, [page, retry]);

  if (loadedPage !== page) return <PageLoader label="Loading Orders" />;
  if (failure)
    return (
      <main className="orders-page">
        <ErrorState
          message={failure}
          onRetry={() => setRetry((value) => value + 1)}
        />
      </main>
    );
  if (!response?.items.length)
    return (
      <main className="orders-page">
        <EmptyState title="No Orders yet">
          Completed checkouts will appear here with one section per Seller.
        </EmptyState>
        <Link className="button button-primary empty-cart-link" to="/products">
          Browse catalog
        </Link>
      </main>
    );
  const totalPages = Math.ceil(response.total / response.pageSize);
  return (
    <main className="orders-page">
      <header className="orders-heading">
        <span className="eyebrow">Purchase history</span>
        <h1>Your Orders.</h1>
        <p>
          {response.total} marketplace{" "}
          {response.total === 1 ? "Order" : "Orders"}
        </p>
      </header>
      <div className="order-list">
        {response.items.map((order) => (
          <Link className="order-row" to={`/orders/${order.id}`} key={order.id}>
            <div>
              <span>Order #{order.id.slice(0, 8)}</span>
              <strong>{formatDate(order.createdAt)}</strong>
            </div>
            <div>
              <span>Seller shipments</span>
              <strong>{order.sellerOrders.length}</strong>
            </div>
            <OrderStatusBadge status={order.status} />
            <strong className="order-total">
              {formatCurrency(order.totalAmount, order.currency)}
            </strong>
            <span className="row-arrow">→</span>
          </Link>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPage={(nextPage) =>
          setParams(nextPage === 1 ? {} : { page: String(nextPage) })
        }
      />
    </main>
  );
}

function positivePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
