import { apiRequest } from "../../api/client";
import type { Cart, CheckoutOrder } from "../../entities/cart/cart.types";

export const cartApi = {
  get(): Promise<Cart> {
    return apiRequest("/cart", { authenticated: true });
  },
  add(productId: string, quantity: number): Promise<Cart> {
    return apiRequest("/cart/items", {
      method: "POST",
      authenticated: true,
      body: { productId, quantity },
    });
  },
  update(productId: string, quantity: number): Promise<Cart> {
    return apiRequest(`/cart/items/${productId}`, {
      method: "PATCH",
      authenticated: true,
      body: { quantity },
    });
  },
  remove(productId: string): Promise<Cart> {
    return apiRequest(`/cart/items/${productId}`, {
      method: "DELETE",
      authenticated: true,
    });
  },
  clear(): Promise<void> {
    return apiRequest("/cart", { method: "DELETE", authenticated: true });
  },
  checkout(
    idempotencyKey: string,
    requestContext: string,
  ): Promise<CheckoutOrder> {
    return apiRequest("/checkout", {
      method: "POST",
      authenticated: true,
      headers: { "Idempotency-Key": idempotencyKey },
      body: { requestContext },
    });
  },
};
