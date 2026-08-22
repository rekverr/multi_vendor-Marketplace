import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export function HomePage() {
  const auth = useAuth();
  return (
    <main className="home-page">
      <section className="home-copy">
        <span className="eyebrow">Multi-vendor marketplace</span>
        <h1>Trade with clarity. Move in real time.</h1>
        <p>
          A reliable marketplace foundation for products, auctions, orders, and
          independent sellers.
        </p>
        <div className="home-actions">
          <Link
            className="button button-primary"
            to={auth.user ? "/account" : "/register"}
          >
            {auth.user ? "Open account" : "Create account"}
          </Link>
          <Link className="button button-secondary" to="/products">
            Browse catalog
          </Link>
        </div>
      </section>
      <aside className="home-orbit" aria-label="Marketplace capabilities">
        <div className="orbit-core">
          <span>Live</span>
          <strong>Market</strong>
        </div>
        <span className="orbit-tag tag-one">Products</span>
        <span className="orbit-tag tag-two">Auctions</span>
        <span className="orbit-tag tag-three">Orders</span>
      </aside>
    </main>
  );
}
