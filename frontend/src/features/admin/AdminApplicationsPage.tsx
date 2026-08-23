import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { formatDate } from "../../lib/format";
import { adminApi } from "./admin.api";
import { AdminTable, type AdminColumn } from "./AdminTable";
import type { ApplicationStatus, SellerApplication } from "./admin.types";
import { ConfirmDialog } from "./ConfirmDialog";

export function AdminApplicationsPage() {
  const [status, setStatus] = useState<ApplicationStatus | "">("PENDING");
  const [items, setItems] = useState<SellerApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi
      .applications(status || undefined, controller.signal)
      .then(setItems)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(adminError(requestError));
      });
    return () => controller.abort();
  }, [status]);
  async function moderate(
    item: SellerApplication,
    action: "approve" | "reject",
    reason = "",
  ) {
    setError(null);
    try {
      const updated =
        action === "approve"
          ? await adminApi.approveApplication(item.id)
          : await adminApi.rejectApplication(item.id, reason);
      setItems(
        (current) =>
          current
            ?.map((entry) => (entry.id === updated.id ? updated : entry))
            .filter((entry) => !status || entry.status === status) ?? null,
      );
    } catch (requestError) {
      setError(adminError(requestError));
      throw requestError;
    }
  }
  const columns: AdminColumn<SellerApplication>[] = [
    {
      label: "Applicant",
      render: (item) => (
        <div>
          <strong>{item.displayName}</strong>
          <small>{item.user.email}</small>
        </div>
      ),
    },
    { label: "Submitted", render: (item) => formatDate(item.createdAt) },
    {
      label: "Status",
      render: (item) => (
        <span className={`admin-status status-${item.status.toLowerCase()}`}>
          {item.status}
        </span>
      ),
    },
    {
      label: "Actions",
      render: (item) =>
        item.status === "PENDING" ? (
          <div className="table-actions">
            <ConfirmDialog
              title={`Approve ${item.displayName}?`}
              description="This atomically creates the Seller profile and changes the persisted User role."
              confirmLabel="Approve Seller"
              onConfirm={() => moderate(item, "approve")}
            >
              <button className="text-button">Approve</button>
            </ConfirmDialog>
            <ConfirmDialog
              title={`Reject ${item.displayName}?`}
              description="Provide the persisted rejection reason visible in moderation records."
              confirmLabel="Reject application"
              requireText
              onConfirm={(reason) => moderate(item, "reject", reason)}
            >
              <button className="text-button danger-text">Reject</button>
            </ConfirmDialog>
          </div>
        ) : (
          <small>
            {item.rejectionReason ?? item.reviewedBy?.email ?? "Reviewed"}
          </small>
        ),
    },
  ];
  if (!items && !error)
    return <PageLoader label="Loading Seller applications" />;
  return (
    <section className="admin-section">
      <header className="admin-section-heading">
        <div>
          <span className="eyebrow">Identity moderation</span>
          <h2>Seller applications</h2>
        </div>
        <label>
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ApplicationStatus | "")
            }
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
      </header>
      {error && <ErrorState message={error} />}
      {items?.length === 0 ? (
        <EmptyState title="No applications">
          No Seller applications match this status.
        </EmptyState>
      ) : (
        items && <AdminTable columns={columns} items={items} />
      )}
    </section>
  );
}
function adminError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409)
    return `State conflict: ${error.message}`;
  if (error instanceof ApiError && error.status === 403)
    return "Forbidden: backend Admin authorization was not satisfied.";
  return errorMessage(error);
}
