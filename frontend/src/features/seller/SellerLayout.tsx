import { NavLink, Outlet } from "react-router-dom";

export function SellerLayout() {
  return (
    <main className="seller-workspace">
      <header className="seller-heading">
        <div>
          <span className="eyebrow">Seller workspace</span>
          <h1>Run your storefront.</h1>
        </div>
        <NavLink className="button button-primary" to="/seller/products/new">
          New Product
        </NavLink>
      </header>
      <nav className="seller-tabs" aria-label="Seller workspace">
        <NavLink end to="/seller">
          Dashboard
        </NavLink>
        <NavLink to="/seller/products">Products</NavLink>
        <NavLink to="/seller/orders">Orders</NavLink>
      </nav>
      <Outlet />
    </main>
  );
}
