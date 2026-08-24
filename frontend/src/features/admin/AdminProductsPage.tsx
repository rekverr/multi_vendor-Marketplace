import { useEffect, useState } from "react";
import { ApiError, errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { formatDate, formatMoney } from "../../lib/format";
import type { ProductStatus } from "../seller/seller.types";
import { adminApi } from "./admin.api";
import type { AdminProduct } from "./admin.types";
import { AdminTable, type AdminColumn } from "./AdminTable";
import { ConfirmDialog } from "./ConfirmDialog";

export function AdminProductsPage() {
  const [status, setStatus] = useState<ProductStatus>("PENDING_REVIEW");
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void adminApi
      .products(status, controller.signal)
      .then(setItems)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(moderationError(requestError));
      });
    return () => controller.abort();
  }, [status]);

  async function moderate(
    item: AdminProduct,
    action: "approve" | "reject",
    reason = "",
  ) {
    setError(null);
    try {
      const updated =
        action === "approve"
          ? await adminApi.approveProduct(item.id)
          : await adminApi.rejectProduct(item.id, reason);
      setItems(
        (current) =>
          current?.filter((entry) => entry.id !== updated.id) ?? null,
      );
    } catch (requestError) {
      setError(moderationError(requestError));
      throw requestError;
    }
  }

  const columns: AdminColumn<AdminProduct>[] = [
    {
      label: "Product",
      render: (item) => (
        <div>
          <strong>{item.title}</strong>
          <small>{item.category.name}</small>
        </div>
      ),
    },
    {
      label: "Seller",
      render: (item) => item.seller.displayName,
    },
    {
      label: "Price / stock",
      render: (item) => (
        <div>
          <strong>
            {item.type === "FIXED_PRICE"
              ? formatMoney(item.price)
              : "Auction"}
          </strong>
          <small>{item.stock} in stock</small>
        </div>
      ),
    },
    { label: "Submitted", render: (item) => formatDate(item.updatedAt) },
    {
      label: "Status",
      render: (item) => (
        <span className={`admin-status status-${item.status.toLowerCase()}`}>
          {item.status.replace("_", " ")}
        </span>
      ),
    },
    {
      label: "Actions",
      render: (item) =>
        item.status === "PENDING_REVIEW" ? (
          <div className="table-actions">
            <ConfirmDialog
              title={`Publish ${item.title}?`}
              description="Approval makes this Product publicly visible and schedules its search projection update."
              confirmLabel="Approve Product"
              onConfirm={() => moderate(item, "approve")}
            >
              <button className="text-button">Approve</button>
            </ConfirmDialog>
            <ConfirmDialog
              title={`Reject ${item.title}?`}
              description="Provide a reason the Seller can address before requesting publication again."
              confirmLabel="Reject Product"
              requireText
              onConfirm={(reason) => moderate(item, "reject", reason)}
            >
              <button className="text-button danger-text">Reject</button>
            </ConfirmDialog>
          </div>
        ) : (
          <small>{item.rejectionReason ?? item.moderatedBy?.email ?? "Reviewed"}</small>
        ),
    },
  ];

  if (!items && !error) return <PageLoader label="Loading Products" />;

  return (
    <section className="admin-section">
      <header className="admin-section-heading">
        <div>
          <span className="eyebrow">Catalog moderation</span>
          <h2>Products</h2>
        </div>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ProductStatus)}
          >
            <option value="PENDING_REVIEW">Pending review</option>
            <option value="PUBLISHED">Published</option>
            <option value="REJECTED">Rejected</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </header>
      {error && <ErrorState message={error} />}
      {items?.length === 0 ? (
        <EmptyState title="No Products">
          No Products match this moderation state.
        </EmptyState>
      ) : (
        items && <AdminTable columns={columns} items={items} />
      )}
    </section>
  );
}

function moderationError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409)
    return `State conflict: ${error.message}`;
  if (error instanceof ApiError && error.status === 403)
    return "Forbidden: backend Admin authorization was not satisfied.";
  return errorMessage(error);
}
