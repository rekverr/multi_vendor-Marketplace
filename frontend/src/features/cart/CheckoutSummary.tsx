import { formatMoney } from "../../lib/format";

export function CheckoutSummary({
  itemCount,
  subtotal,
  pending,
  mutating,
  canCheckout,
  retrying,
  onCheckout,
}: {
  itemCount: number;
  subtotal: string;
  pending: boolean;
  mutating: boolean;
  canCheckout: boolean;
  retrying: boolean;
  onCheckout: () => void;
}) {
  return (
    <aside className="cart-summary">
      <span className="eyebrow">Server summary</span>
      <div>
        <span>Items</span>
        <strong>{itemCount}</strong>
      </div>
      <div className="summary-total">
        <span>Current subtotal</span>
        <strong>{pending ? "Syncing..." : formatMoney(subtotal)}</strong>
      </div>
      <p>
        Cart stock is not reserved. Product availability and all prices are
        revalidated inside checkout.
      </p>
      <button
        className="button button-primary"
        disabled={mutating || (!canCheckout && !retrying)}
        onClick={onCheckout}
      >
        {mutating
          ? "Processing..."
          : retrying
            ? "Retry checkout safely"
            : "Checkout"}
      </button>
      {retrying && (
        <small>A previous checkout identity is preserved for a safe retry.</small>
      )}
    </aside>
  );
}
