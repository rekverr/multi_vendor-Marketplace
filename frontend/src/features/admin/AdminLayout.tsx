import { NavLink, Outlet } from "react-router-dom";
export function AdminLayout() {
  return (
    <main className="admin-workspace">
      <header className="admin-heading">
        <div>
          <span className="eyebrow">Marketplace control</span>
          <h1>Admin desk.</h1>
        </div>
        <p>All permissions and transitions remain enforced by the backend.</p>
      </header>
      <nav className="admin-tabs" aria-label="Admin workspace">
        <NavLink end to="/admin">
          Analytics
        </NavLink>
        <NavLink to="/admin/applications">Seller applications</NavLink>
        <NavLink to="/admin/categories">Categories</NavLink>
        <NavLink to="/admin/products">Products</NavLink>
        <NavLink to="/admin/disputes">Disputes</NavLink>
      </nav>
      <Outlet />
    </main>
  );
}
