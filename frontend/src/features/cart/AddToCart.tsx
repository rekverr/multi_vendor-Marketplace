import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/api-error";
import type { PublicProduct } from "../../entities/product/product.types";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "./CartContext";

export function AddToCart({ product }: { product: PublicProduct }) {
  const auth = useAuth();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  if (product.type !== "FIXED_PRICE") return null;
  if (product.stock <= 0)
    return (
      <span className="availability-note">
        This Product is not currently purchasable.
      </span>
    );
  if (auth.status !== "authenticated")
    return (
      <Link
        className="button button-primary"
        to="/login"
        state={{ from: `/products/${product.id}` }}
      >
        Sign in to add to Cart
      </Link>
    );
  if (auth.user?.role !== "CUSTOMER")
    return (
      <span className="availability-note">
        Cart is available to Customer accounts.
      </span>
    );

  return (
    <div className="add-to-cart">
      <label>
        Quantity
        <input
          type="number"
          min="1"
          max={Math.min(999, product.stock)}
          value={quantity}
          onChange={(event) => setQuantity(event.target.valueAsNumber)}
        />
      </label>
      <button
        className="button button-primary"
        disabled={
          cart.mutating ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > product.stock
        }
        onClick={() => {
          setNotice(null);
          void cart
            .add(product, quantity)
            .then(() => setNotice("Added to Cart."))
            .catch((requestError: unknown) =>
              setNotice(errorMessage(requestError)),
            );
        }}
      >
        {cart.mutating ? "Updating..." : "Add to Cart"}
      </button>
      {notice && (
        <p className="cart-inline-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
