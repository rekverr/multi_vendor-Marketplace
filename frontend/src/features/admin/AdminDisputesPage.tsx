import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { formatDate } from "../../lib/format";
import { Pagination } from "../catalog/Pagination";
import { adminApi } from "./admin.api";
import { AdminTable, type AdminColumn } from "./AdminTable";
import type {
  AdminDispute,
  DisputeStatus,
  DisputesResponse,
} from "./admin.types";

const STATUSES: DisputeStatus[] = [
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "REJECTED",
  "CLOSED",
];
export function AdminDisputesPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const status = (params.get("status") ?? "") as DisputeStatus | "";
  const [data, setData] = useState<DisputesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi
      .disputes(page, status || undefined, controller.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [page, status]);
  const columns: AdminColumn<AdminDispute>[] = [
    {
      label: "Dispute",
      render: (item) => (
        <div>
          <strong>
            {item.orderItem?.productTitle ?? "SellerOrder dispute"}
          </strong>
          <small>
            {item.id.slice(0, 8)} · {formatDate(item.createdAt)}
          </small>
        </div>
      ),
    },
    {
      label: "Reason",
      render: (item) => <span className="clamped-cell">{item.reason}</span>,
    },
    {
      label: "Status",
      render: (item) => (
        <span className={`admin-status status-${item.status.toLowerCase()}`}>
          {item.status.replace("_", " ")}
        </span>
      ),
    },
    {
      label: "Action",
      render: (item) => (
        <Link className="text-button" to={`/admin/disputes/${item.id}`}>
          Review
        </Link>
      ),
    },
  ];
  if (!data && !error) return <PageLoader label="Loading disputes" />;
  return (
    <section className="admin-section">
      <header className="admin-section-heading">
        <div>
          <span className="eyebrow">Resolution queue</span>
          <h2>Disputes</h2>
        </div>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              const next = event.target.value;
              setParams(next ? { status: next, page: "1" } : {});
            }}
          >
            <option value="">All</option>
            {STATUSES.map((value) => (
              <option value={value} key={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && <ErrorState message={error} />}
      {data?.items.length === 0 ? (
        <EmptyState title="No disputes">
          No disputes match this filter.
        </EmptyState>
      ) : (
        data && <AdminTable columns={columns} items={data.items} />
      )}
      {data && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPage={(next) =>
            setParams(
              status ? { status, page: String(next) } : { page: String(next) },
            )
          }
        />
      )}
    </section>
  );
}
