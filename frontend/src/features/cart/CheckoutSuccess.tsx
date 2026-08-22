import { Link } from "react-router-dom";
import type { CheckoutOrder } from "../../entities/cart/cart.types";
import { formatCurrency, formatDate } from "../../lib/format";

export function CheckoutSuccess({ order }: { order: CheckoutOrder }) {
  return (
    <main className="checkout-success">
      <span className="success-check" aria-hidden="true">
        ✓
      </span>
      <span className="eyebrow">Checkout complete</span>
      <h1>Your Order is confirmed.</h1>
      <p>
        Order <strong>#{order.id.slice(0, 8)}</strong> ·{" "}
        {formatDate(order.createdAt)}
      </p>
      <section className="receipt">
        <header>
          <span>
            {order.sellerOrders.length} seller{" "}
            {order.sellerOrders.length === 1 ? "shipment" : "shipments"}
          </span>
          <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
        </header>
        {order.sellerOrders.map((sellerOrder) => (
          <article key={sellerOrder.id}>
            <div>
              <strong>{sellerOrder.seller.displayName}</strong>
              <span>{sellerOrder.status}</span>
            </div>
            {sellerOrder.items.map((item) => (
              <p key={item.id}>
                <span>
                  {item.productTitle} × {item.quantity}
                </span>
                <strong>
                  {formatCurrency(item.lineTotal, sellerOrder.currency)}
                </strong>
              </p>
            ))}
          </article>
        ))}
      </section>
      <div className="home-actions">
        <Link className="button button-primary" to="/account">
          Open account
        </Link>
        <Link className="button button-secondary" to="/products">
          Continue browsing
        </Link>
      </div>
    </main>
  );
}
