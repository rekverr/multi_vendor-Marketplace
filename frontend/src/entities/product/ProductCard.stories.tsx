import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductCard } from "./ProductCard";
import type { PublicProduct } from "./product.types";

const product: PublicProduct = {
  id: "product-1",
  title:
    "Hand-finished walnut mechanical keyboard with an intentionally long catalog title",
  description: "A durable keyboard.",
  imageUrl: null,
  stock: 8,
  type: "FIXED_PRICE",
  price: "149.90",
  ratingAverage: "4.75",
  ratingCount: 42,
  publishedAt: "2026-08-20T12:00:00.000Z",
  createdAt: "2026-08-19T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
  category: { id: "category-1", name: "Workspace" },
  seller: { id: "seller-1", displayName: "Northern Grain Studio" },
  auction: null,
};
const meta = {
  title: "Catalog/ProductCard",
  component: ProductCard,
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProductCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FixedPrice: Story = { args: { product } };
export const Auction: Story = {
  args: {
    product: {
      ...product,
      id: "product-2",
      type: "AUCTION",
      price: null,
      stock: 1,
      auction: { id: "auction-1", status: "ACTIVE" },
    },
  },
};
export const OutOfStock: Story = {
  args: {
    product: {
      ...product,
      id: "product-3",
      stock: 0,
      ratingCount: 0,
      ratingAverage: "0",
    },
  },
};
