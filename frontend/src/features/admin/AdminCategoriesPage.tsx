import { useEffect, useState, type FormEvent } from "react";
import { ApiError, errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { adminApi } from "./admin.api";
import { AdminTable, type AdminColumn } from "./AdminTable";
import type { AdminCategory } from "./admin.types";
import { ConfirmDialog } from "./ConfirmDialog";

export function AdminCategoriesPage() {
  const [items, setItems] = useState<AdminCategory[] | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi
      .categories(controller.signal)
      .then(setItems)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (value.length < 2 || value.length > 100) {
      setError("Category name must contain 2 to 100 characters.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const saved = editing
        ? await adminApi.updateCategory(editing.id, value)
        : await adminApi.createCategory(value);
      setItems((current) =>
        editing
          ? (current?.map((item) => (item.id === saved.id ? saved : item)) ??
            null)
          : [...(current ?? []), saved].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
      setName("");
      setEditing(null);
    } catch (requestError) {
      setError(categoryError(requestError));
    } finally {
      setPending(false);
    }
  }
  async function remove(item: AdminCategory) {
    try {
      await adminApi.deleteCategory(item.id);
      setItems(
        (current) => current?.filter((entry) => entry.id !== item.id) ?? null,
      );
    } catch (requestError) {
      setError(categoryError(requestError));
      throw requestError;
    }
  }
  const columns: AdminColumn<AdminCategory>[] = [
    { label: "Name", render: (item) => <strong>{item.name}</strong> },
    {
      label: "Updated",
      render: (item) => new Date(item.updatedAt).toLocaleDateString(),
    },
    {
      label: "Actions",
      render: (item) => (
        <div className="table-actions">
          <button
            className="text-button"
            onClick={() => {
              setEditing(item);
              setName(item.name);
            }}
          >
            Edit
          </button>
          <ConfirmDialog
            title={`Delete ${item.name}?`}
            description="Deletion succeeds only when no Product references this Category."
            confirmLabel="Delete Category"
            onConfirm={() => remove(item)}
          >
            <button className="text-button danger-text">Delete</button>
          </ConfirmDialog>
        </div>
      ),
    },
  ];
  if (!items && !error) return <PageLoader label="Loading Categories" />;
  return (
    <section className="admin-section">
      <header className="admin-section-heading">
        <div>
          <span className="eyebrow">Catalog taxonomy</span>
          <h2>Categories</h2>
        </div>
      </header>
      <form className="admin-inline-form" onSubmit={save}>
        <label>
          {editing ? "Rename Category" : "New Category"}
          <input
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button className="button button-primary" disabled={pending}>
          {pending ? "Saving..." : editing ? "Save name" : "Create Category"}
        </button>
        {editing && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            Cancel
          </button>
        )}
      </form>
      {error && <ErrorState message={error} />}
      {items?.length === 0 ? (
        <EmptyState title="No Categories">
          Create the first Product Category.
        </EmptyState>
      ) : (
        items && <AdminTable columns={columns} items={items} />
      )}
    </section>
  );
}
function categoryError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409)
    return `Category conflict: ${error.message}`;
  if (error instanceof ApiError && error.status === 403)
    return "Forbidden: backend Admin authorization was not satisfied.";
  return errorMessage(error);
}
