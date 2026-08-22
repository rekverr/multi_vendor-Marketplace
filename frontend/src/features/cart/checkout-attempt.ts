import type { Cart, CheckoutAttempt } from "../../entities/cart/cart.types";

const KEY = "marketplace.checkout-attempt";

export function cartSignature(cart: Cart | null): string {
  return (
    cart?.items
      .map((item) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join("|") ?? ""
  );
}

export function readCheckoutAttempt(): CheckoutAttempt | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<CheckoutAttempt>;
    return typeof parsed.customerId === "string" &&
      typeof parsed.idempotencyKey === "string" &&
      typeof parsed.requestContext === "string" &&
      typeof parsed.cartSignature === "string"
      ? (parsed as CheckoutAttempt)
      : null;
  } catch {
    return null;
  }
}

export function createCheckoutAttempt(
  customerId: string,
  signature: string,
): CheckoutAttempt {
  const commandId = crypto.randomUUID();
  const attempt = {
    customerId,
    idempotencyKey: `checkout:${commandId}`,
    requestContext: commandId,
    cartSignature: signature,
  };
  writeCheckoutAttempt(attempt);
  return attempt;
}

export function writeCheckoutAttempt(attempt: CheckoutAttempt): void {
  sessionStorage.setItem(KEY, JSON.stringify(attempt));
}

export function clearCheckoutAttempt(): void {
  sessionStorage.removeItem(KEY);
}
