import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, errorMessage } from "../../api/api-error";
import { PageLoader } from "../../components/PageLoader";
import type {
  NamedReference,
  ProductType,
} from "../../entities/product/product.types";
import { sellerApi } from "./seller.api";
import type { ProductInput, SellerProduct } from "./seller.types";

interface FormState {
  categoryId: string;
  title: string;
  description: string;
  imageUrl: string;
  type: ProductType;
  price: string;
  stock: string;
}
const blank: FormState = {
  categoryId: "",
  title: "",
  description: "",
  imageUrl: "",
  type: "FIXED_PRICE",
  price: "",
  stock: "0",
};
const MONEY = /^(0|[1-9]\d{0,16})(\.\d{1,2})?$/;
export function ProductEditorPage() {
  const { productId } = useParams();
  const editing = Boolean(productId);
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [product, setProduct] = useState<SellerProduct | null>(null);
  const [categories, setCategories] = useState<NamedReference[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      sellerApi.categories(controller.signal),
      productId
        ? sellerApi.product(productId, controller.signal)
        : Promise.resolve(null),
    ])
      .then(([options, current]) => {
        setCategories(options);
        if (current) {
          setProduct(current);
          setForm({
            categoryId: current.category.id,
            title: current.title,
            description: current.description,
            imageUrl: current.imageUrl ?? "",
            type: current.type,
            price: current.price ?? "",
            stock: String(current.stock),
          });
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, [productId]);
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validate(form);
    if (validation) {
      setError(validation);
      return;
    }
    const input: ProductInput = {
      categoryId: form.categoryId,
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || null,
      type: form.type,
      stock: Number(form.stock),
      ...(form.type === "FIXED_PRICE" ? { price: form.price } : {}),
    };
    setPending(true);
    try {
      const saved = productId
        ? await sellerApi.updateProduct(productId, input)
        : await sellerApi.createProduct(input);
      navigate(`/seller/products/${saved.id}`, { replace: !editing });
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 409
          ? `Product conflict: ${requestError.message}`
          : requestError instanceof ApiError && requestError.status === 403
            ? "Forbidden: backend Seller approval or ownership check failed."
            : errorMessage(requestError),
      );
    } finally {
      setPending(false);
    }
  }
  if (!categories) return <PageLoader label="Loading Product editor" />;
  const editable = !product || ["DRAFT", "REJECTED"].includes(product.status);
  return (
    <section className="seller-section">
      <Link className="back-link" to="/seller/products">
        ← Products
      </Link>
      <header className="section-heading">
        <div>
          <span className="eyebrow">
            {editing ? "Product editor" : "New inventory"}
          </span>
          <h2>{editing ? product?.title : "Create Product"}</h2>
        </div>
        {product && (
          <span
            className={`product-state state-${product.status.toLowerCase()}`}
          >
            {product.status}
          </span>
        )}
      </header>
      {!editable && (
        <div className="seller-notice conflict-notice">
          This Product cannot be edited while {product?.status}. The backend
          enforces lifecycle rules.
        </div>
      )}
      <form className="seller-form" onSubmit={submit}>
        <label>
          Title
          <input
            required
            minLength={2}
            maxLength={200}
            disabled={!editable}
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
          />
        </label>
        <label>
          Category
          <select
            required
            disabled={!editable}
            value={form.categoryId}
            onChange={(event) => set("categoryId", event.target.value)}
          >
            <option value="">Select Category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="span-two">
          Description
          <textarea
            required
            maxLength={5000}
            disabled={!editable}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </label>
        <label>
          Image URL
          <input
            type="url"
            maxLength={2048}
            disabled={!editable}
            value={form.imageUrl}
            onChange={(event) => set("imageUrl", event.target.value)}
          />
        </label>
        <label>
          Type
          <select
            disabled={editing || !editable}
            value={form.type}
            onChange={(event) => set("type", event.target.value as ProductType)}
          >
            <option value="FIXED_PRICE">Fixed price</option>
            <option value="AUCTION">Auction</option>
          </select>
        </label>
        {form.type === "FIXED_PRICE" && (
          <label>
            Price
            <input
              inputMode="decimal"
              required
              disabled={!editable}
              value={form.price}
              onChange={(event) => set("price", event.target.value)}
            />
          </label>
        )}
        <label>
          Stock
          <input
            type="number"
            required
            min={0}
            max={2147483647}
            disabled={!editable}
            value={form.stock}
            onChange={(event) => set("stock", event.target.value)}
          />
        </label>
        {error && (
          <div className="seller-notice error-notice span-two" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions span-two">
          <button
            className="button button-primary"
            disabled={pending || !editable}
          >
            {pending ? "Saving..." : "Save Product"}
          </button>
          {product?.type === "AUCTION" && (
            <Link
              className="button button-secondary"
              to={`/seller/products/${product.id}/auction`}
            >
              Configure Auction
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
function validate(form: FormState): string | null {
  if (form.title.trim().length < 2)
    return "Title must contain at least 2 characters.";
  if (!form.categoryId) return "Select a Category.";
  if (!form.description.trim()) return "Description is required.";
  if (form.imageUrl && !/^https?:\/\//i.test(form.imageUrl))
    return "Image URL must use http or https.";
  if (!/^\d+$/.test(form.stock) || Number(form.stock) > 2147483647)
    return "Stock must be a non-negative whole number.";
  if (form.type === "FIXED_PRICE" && !MONEY.test(form.price))
    return "Price must be a non-negative amount with at most two decimals.";
  if (form.type === "AUCTION" && Number(form.stock) !== 1)
    return "Auction Product stock must equal 1.";
  return null;
}
