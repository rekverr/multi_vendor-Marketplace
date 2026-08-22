import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, errorMessage } from "../../api/api-error";
import { EmptyState, ErrorState } from "../../components/AsyncState";
import { PageLoader } from "../../components/PageLoader";
import { StockBadge } from "../../entities/product/StockBadge";
import { formatMoney } from "../../lib/format";
import { sellerApi } from "./seller.api";
import type { SellerProduct } from "./seller.types";

export function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void sellerApi
      .products(controller.signal)
      .then(setProducts)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [reload]);
  async function action(product: SellerProduct, kind: "publish" | "archive") {
    setError(null);
    try {
      const updated =
        kind === "publish"
          ? await sellerApi.requestPublication(product.id)
          : await sellerApi.archiveProduct(product.id);
      setProducts(
        (current) =>
          current?.map((item) => (item.id === updated.id ? updated : item)) ??
          null,
      );
    } catch (requestError) {
      setError(actionError(requestError));
    }
  }
  if (!products && !error) return <PageLoader label="Loading your Products" />;
  return (
    <section className="seller-section">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Inventory</span>
          <h2>Own Products</h2>
        </div>
        <span>{products?.length ?? 0} total</span>
      </header>
      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setReload((value) => value + 1);
          }}
        />
      )}
      {products?.length === 0 && (
        <EmptyState title="No Products yet">
          Create a draft to begin building your Seller catalog.
        </EmptyState>
      )}
      <div className="seller-product-list">
        {products?.map((product) => (
          <article key={product.id}>
            <div className="seller-product-image">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" />
              ) : (
                product.title.slice(0, 1)
              )}
            </div>
            <div>
              <span className="eyebrow">
                {product.category.name} · {product.type.replace("_", " ")}
              </span>
              <h3>
                <Link to={`/seller/products/${product.id}`}>
                  {product.title}
                </Link>
              </h3>
              <div className="seller-row-meta">
                <span
                  className={`product-state state-${product.status.toLowerCase()}`}
                >
                  {product.status.replace("_", " ")}
                </span>
                <StockBadge stock={product.stock} />
                <strong>
                  {product.type === "FIXED_PRICE"
                    ? formatMoney(product.price)
                    : "Auction pricing"}
                </strong>
              </div>
              {product.rejectionReason && (
                <p className="error-copy">
                  Rejected: {product.rejectionReason}
                </p>
              )}
            </div>
            <div className="seller-row-actions">
              <Link
                className="text-button"
                to={`/seller/products/${product.id}`}
              >
                Edit
              </Link>
              {product.type === "AUCTION" && (
                <Link
                  className="text-button"
                  to={`/seller/products/${product.id}/auction`}
                >
                  Auction
                </Link>
              )}
              {["DRAFT", "REJECTED"].includes(product.status) && (
                <button
                  className="text-button"
                  onClick={() => void action(product, "publish")}
                >
                  Request publication
                </button>
              )}
              {product.status !== "ARCHIVED" && (
                <button
                  className="text-button danger-text"
                  onClick={() => void action(product, "archive")}
                >
                  Archive
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function actionError(error: unknown): string {
  if (error instanceof ApiError && error.status === 403)
    return "Forbidden: your Seller approval or ownership could not be verified.";
  if (error instanceof ApiError && error.status === 409)
    return `Lifecycle conflict: ${error.message}`;
  return errorMessage(error);
}
