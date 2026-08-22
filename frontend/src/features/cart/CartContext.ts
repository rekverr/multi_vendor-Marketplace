import { createContext, use } from "react";
import type {
  Cart,
  CheckoutAttempt,
  CheckoutOrder,
} from "../../entities/cart/cart.types";
import type { PublicProduct } from "../../entities/product/product.types";

export interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  checkoutAttempt: CheckoutAttempt | null;
  checkoutOrder: CheckoutOrder | null;
  refresh: () => Promise<void>;
  add: (product: PublicProduct, quantity: number) => Promise<void>;
  update: (productId: string, quantity: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  checkout: () => Promise<void>;
  dismissError: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const context = use(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
