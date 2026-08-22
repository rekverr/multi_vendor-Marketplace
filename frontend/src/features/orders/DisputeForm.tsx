import { useState, type FormEvent } from "react";
import { errorMessage } from "../../api/api-error";
import type { Dispute } from "../../entities/order/order.types";
import { ordersApi } from "./orders.api";

export function DisputeForm({
  orderId,
  sellerOrderId,
  orderItemId,
  label,
  onCreated,
}: {
  orderId: string;
  sellerOrderId: string;
  orderItemId?: string;
  label: string;
  onCreated: (dispute: Dispute) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const dispute = await ordersApi.dispute(orderId, {
        sellerOrderId,
        orderItemId,
        reason,
      });
      onCreated(dispute);
      setOpen(false);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open)
    return (
      <button
        className="text-button dispute-trigger"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  return (
    <form className="dispute-form" onSubmit={submit}>
      <label>
        Describe the issue
        <textarea
          minLength={10}
          maxLength={2000}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Include the relevant purchase details."
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div>
        <button
          type="button"
          className="text-button"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          disabled={submitting || reason.trim().length < 10}
        >
          {submitting ? "Submitting..." : "Open dispute"}
        </button>
      </div>
    </form>
  );
}
