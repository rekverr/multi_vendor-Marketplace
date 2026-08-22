import { Link } from "react-router-dom";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import type { CartItem } from "../../entities/cart/cart.types";
import { formatMoney } from "../../lib/format";
import { useCart } from "./CartContext";
import { CheckoutSuccess } from "./CheckoutSuccess";

export function CartPage() {
  const cartState = useCart();
  if (cartState.checkoutOrder)
    return <CheckoutSuccess order={cartState.checkoutOrder} />;
  if (cartState.loading) return <PageLoader label="Loading Cart" />;
  if (!cartState.cart && cartState.error)
    return (
      <main className="cart-page">
        <ErrorState
          message={cartState.error}
          onRetry={() => void cartState.refresh()}
        />
      </main>
    );
  const cart = cartState.cart;
  if (!cart) return <PageLoader label="Preparing Cart" />;
  const groups = groupBySeller(cart.items);
  const canCheckout =
    cart.items.length > 0 &&
    cart.items.every((item) => item.purchasable) &&
    !cart.pending;

  if (cart.items.length === 0 && !cartState.checkoutAttempt)
    return (
      <main className="cart-page">
        <EmptyState title="Your Cart is empty">
          Browse published Products and add something worth returning for.
        </EmptyState>
        <Link className="button button-primary empty-cart-link" to="/products">
          Browse catalog
        </Link>
      </main>
    );

  return (
    <main className="cart-page">
      <header className="cart-heading">
        <div>
          <span className="eyebrow">Customer Cart</span>
          <h1>
            {cart.items.length ? "Ready when you are." : "Recover checkout."}
          </h1>
        </div>
        {cart.items.length > 0 && (
          <button
            className="text-button danger-button"
            disabled={cartState.mutating}
            onClick={() => {
              if (window.confirm("Remove every item from this Cart?"))
                void cartState.clear();
            }}
          >
            Clear Cart
          </button>
        )}
      </header>
      {cartState.error && (
        <div className="checkout-alert" role="alert">
          <strong>{conflictTitle(cartState.error)}</strong>
          <span>{cartState.error}</span>
          <button onClick={cartState.dismissError}>Dismiss</button>
        </div>
      )}
      {cart.items.some((item) => !item.purchasable) && (
        <div className="stock-warning">
          One or more Products are no longer available in the requested
          quantity. Update the Cart before checkout.
        </div>
      )}
      <div className="cart-layout">
        <section className="cart-groups">
          {Array.from(groups.entries()).map(([sellerId, items]) => (
            <article className="seller-cart" key={sellerId}>
              <header>
                <span>Seller</span>
                <strong>{items[0].product.seller.displayName}</strong>
              </header>
              {items.map((item) => (
                <CartLine
                  key={item.product.id}
                  item={item}
                  disabled={cartState.mutating}
                  onQuantity={(quantity) =>
                    void cartState.update(item.product.id, quantity)
                  }
                  onRemove={() => void cartState.remove(item.product.id)}
                />
              ))}
            </article>
          ))}
        </section>
        <aside className="cart-summary">
          <span className="eyebrow">Server summary</span>
          <div>
            <span>Items</span>
            <strong>{cart.itemCount}</strong>
          </div>
          <div className="summary-total">
            <span>Current subtotal</span>
            <strong>
              {cart.pending ? "Syncing..." : formatMoney(cart.subtotal)}
            </strong>
          </div>
          <p>
            Cart stock is not reserved. Product availability and all prices are
            revalidated inside checkout.
          </p>
          <button
            className="button button-primary"
            disabled={
              cartState.mutating || (!canCheckout && !cartState.checkoutAttempt)
            }
            onClick={() => void cartState.checkout()}
          >
            {cartState.mutating
              ? "Processing..."
              : cartState.checkoutAttempt
                ? "Retry checkout safely"
                : "Checkout"}
          </button>
          {cartState.checkoutAttempt && (
            <small>
              A previous checkout identity is preserved for a safe retry.
            </small>
          )}
        </aside>
      </div>
    </main>
  );
}

function CartLine({
  item,
  disabled,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  disabled: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`cart-line ${!item.purchasable ? "cart-line-invalid" : ""}`}
    >
      <Link className="cart-thumb" to={`/products/${item.product.id}`}>
        {item.product.imageUrl ? (
          <img src={item.product.imageUrl} alt="" />
        ) : (
          item.product.title.slice(0, 1)
        )}
      </Link>
      <div className="cart-line-copy">
        <Link to={`/products/${item.product.id}`}>{item.product.title}</Link>
        <span>{item.product.category.name}</span>
        {!item.purchasable && <strong>Unavailable at this quantity</strong>}
      </div>
      <label className="quantity-control">
        Qty
        <input
          key={`${item.product.id}:${item.quantity}`}
          aria-label={`Quantity for ${item.product.title}`}
          type="number"
          min="1"
          max="999"
          defaultValue={item.quantity}
          disabled={disabled}
          onBlur={(event) => {
            const quantity = event.target.valueAsNumber;
            if (quantity !== item.quantity) onQuantity(quantity);
          }}
        />
      </label>
      <div className="line-price">
        <strong>
          {item.pending ? "Updating..." : formatMoney(item.lineTotal)}
        </strong>
        <button disabled={disabled} onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function groupBySeller(items: CartItem[]): Map<string, CartItem[]> {
  const groups = new Map<string, CartItem[]>();
  items.forEach((item) =>
    groups.set(item.product.seller.id, [
      ...(groups.get(item.product.seller.id) ?? []),
      item,
    ]),
  );
  return groups;
}

function conflictTitle(message: string): string {
  const normalized = message.toLowerCase();
  return normalized.includes("stock") || normalized.includes("unavailable")
    ? "Inventory changed"
    : "Cart action failed";
}
