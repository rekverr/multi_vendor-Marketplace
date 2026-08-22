import { AuthProvider } from "../features/auth/AuthProvider";
import { CartProvider } from "../features/cart/CartProvider";
import { AppShell } from "./AppShell";

export function AppRoot() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppShell />
      </CartProvider>
    </AuthProvider>
  );
}
