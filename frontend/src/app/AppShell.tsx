import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { useCart } from "../features/cart/CartContext";

export function AppShell() {
  const auth = useAuth();
  const cart = useCart();
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/">
          <span className="brand-mark">M</span>
          <span>Marketline</span>
        </NavLink>
        <nav aria-label="Main navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/products">Catalog</NavLink>
          {auth.status === "authenticated" ? (
            <>
              <NavLink to="/account">Account</NavLink>
              {auth.hasRole("CUSTOMER") && (
                <>
                  <NavLink to="/orders">Orders</NavLink>
                  <NavLink to="/seller/apply">Sell</NavLink>
                  <NavLink to="/cart">
                    Cart
                    {cart.cart?.itemCount ? (
                      <span className="cart-count">{cart.cart.itemCount}</span>
                    ) : null}
                  </NavLink>
                </>
              )}
              {auth.hasRole("SELLER") && <NavLink to="/seller">Seller</NavLink>}
              {auth.hasRole("ADMIN") && <NavLink to="/admin">Admin</NavLink>}
              <button className="nav-action" onClick={() => void auth.logout()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Sign in</NavLink>
              <NavLink className="nav-join" to="/register">
                Join
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <Outlet />
      <footer className="site-footer">
        <span>Marketline marketplace foundation</span>
        <span>PostgreSQL remains authoritative</span>
      </footer>
    </div>
  );
}
