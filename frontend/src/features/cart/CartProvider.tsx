import { useEffect, useState, type ReactNode } from "react";
import { errorMessage } from "../../api/api-error";
import type {
  Cart,
  CheckoutAttempt,
  CheckoutOrder,
} from "../../entities/cart/cart.types";
import type { PublicProduct } from "../../entities/product/product.types";
import { useAuth } from "../auth/AuthContext";
import { cartApi } from "./cart.api";
import { CartContext } from "./CartContext";
import {
  cartSignature,
  clearCheckoutAttempt,
  createCheckoutAttempt,
  readCheckoutAttempt,
  writeCheckoutAttempt,
} from "./checkout-attempt";

export function CartProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutAttempt, setCheckoutAttempt] =
    useState<CheckoutAttempt | null>(() => readCheckoutAttempt());
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrder | null>(
    null,
  );
  const customerId = auth.user?.role === "CUSTOMER" ? auth.user.id : null;
  const loading = customerId !== null && loadedUserId !== customerId;

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    void cartApi
      .get()
      .then((response) => {
        if (!active) return;
        setCart(response);
        setLoadedUserId(customerId);
        setError(null);
        const stored = readCheckoutAttempt();
        if (
          stored?.customerId !== customerId ||
          (response.items.length > 0 &&
            stored.cartSignature !== cartSignature(response))
        ) {
          clearCheckoutAttempt();
          setCheckoutAttempt(null);
        } else {
          setCheckoutAttempt(stored);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(errorMessage(requestError));
          setLoadedUserId(customerId);
        }
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  async function refresh(): Promise<void> {
    if (!customerId) return;
    try {
      setCart(await cartApi.get());
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
      throw requestError;
    }
  }

  function invalidateAttempt(): void {
    clearCheckoutAttempt();
    setCheckoutAttempt(null);
    setCheckoutOrder(null);
  }

  async function mutate(
    optimistic: (current: Cart) => Cart,
    request: () => Promise<Cart | void>,
  ): Promise<void> {
    if (!cart || mutating) return;
    const snapshot = cart;
    const attemptSnapshot = checkoutAttempt;
    setCart(optimistic(cart));
    setMutating(true);
    setError(null);
    invalidateAttempt();
    try {
      const response = await request();
      if (response) setCart(response);
    } catch (requestError) {
      setCart(snapshot);
      if (attemptSnapshot) {
        writeCheckoutAttempt(attemptSnapshot);
        setCheckoutAttempt(attemptSnapshot);
      }
      setError(errorMessage(requestError));
      throw requestError;
    } finally {
      setMutating(false);
    }
  }

  async function add(product: PublicProduct, quantity: number): Promise<void> {
    await mutate(
      (current) => {
        const existing = current.items.find(
          (item) => item.product.id === product.id,
        );
        const items = existing
          ? current.items.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity, pending: true }
                : item,
            )
          : [
              ...current.items,
              {
                id: `optimistic:${product.id}`,
                quantity,
                lineTotal: null,
                purchasable: true,
                pending: true,
                product: { ...product, status: "PUBLISHED" },
              },
            ];
        return {
          ...current,
          items,
          itemCount: current.itemCount + quantity,
          pending: true,
        };
      },
      () => cartApi.add(product.id, quantity),
    );
  }

  async function update(productId: string, quantity: number): Promise<void> {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setError("Quantity must be between 1 and 999.");
      return;
    }
    await mutate(
      (current) => ({
        ...current,
        pending: true,
        items: current.items.map((item) =>
          item.product.id === productId
            ? { ...item, quantity, pending: true }
            : item,
        ),
        itemCount: current.items.reduce(
          (sum, item) =>
            sum + (item.product.id === productId ? quantity : item.quantity),
          0,
        ),
      }),
      () => cartApi.update(productId, quantity),
    );
  }

  async function remove(productId: string): Promise<void> {
    await mutate(
      (current) => ({
        ...current,
        pending: true,
        items: current.items.filter((item) => item.product.id !== productId),
        itemCount: current.items
          .filter((item) => item.product.id !== productId)
          .reduce((sum, item) => sum + item.quantity, 0),
      }),
      () => cartApi.remove(productId),
    );
  }

  async function clear(): Promise<void> {
    await mutate(
      (current) => ({ ...current, items: [], itemCount: 0, pending: true }),
      async () => {
        await cartApi.clear();
        return cartApi.get();
      },
    );
  }

  async function checkout(): Promise<void> {
    if (!customerId || mutating) return;
    const signature = cartSignature(cart);
    let attempt =
      checkoutAttempt?.customerId === customerId ? checkoutAttempt : null;
    if (cart?.items.length && attempt?.cartSignature !== signature)
      attempt = null;
    if (!attempt) attempt = createCheckoutAttempt(customerId, signature);
    setCheckoutAttempt(attempt);
    setMutating(true);
    setError(null);
    try {
      const order = await cartApi.checkout(
        attempt.idempotencyKey,
        attempt.requestContext,
      );
      setCheckoutOrder(order);
      setCart((current) =>
        current
          ? {
              ...current,
              items: [],
              itemCount: 0,
              subtotal: "0",
              pending: false,
            }
          : current,
      );
      clearCheckoutAttempt();
      setCheckoutAttempt(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
      throw requestError;
    } finally {
      setMutating(false);
    }
  }

  return (
    <CartContext
      value={{
        cart,
        loading,
        mutating,
        error,
        checkoutAttempt,
        checkoutOrder,
        refresh,
        add,
        update,
        remove,
        clear,
        checkout,
        dismissError: () => setError(null),
      }}
    >
      {children}
    </CartContext>
  );
}
