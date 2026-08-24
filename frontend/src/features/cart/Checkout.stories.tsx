import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CheckoutOrder } from "../../entities/cart/cart.types";
import { CheckoutSuccess } from "./CheckoutSuccess";
import { CheckoutSummary } from "./CheckoutSummary";

const order: CheckoutOrder = {
  id: "c44ff26e-e6a3-4fdb-8fd0-89161c6d2f89",
  status: "NEW",
  currency: "USD",
  totalAmount: "349.80",
  createdAt: "2026-08-24T10:00:00.000Z",
  sellerOrders: [
    {
      id: "seller-order-1",
      status: "NEW",
      currency: "USD",
      grossAmount: "349.80",
      seller: { id: "seller-1", displayName: "Northern Grain Studio" },
      items: [
        {
          id: "item-1",
          productId: "product-1",
          productTitle: "Walnut mechanical keyboard",
          productImageUrl: null,
          unitPrice: "174.90",
          quantity: 2,
          lineTotal: "349.80",
        },
      ],
    },
  ],
};

const meta = {
  title: "Cart/Checkout",
  component: CheckoutSummary,
  args: {
    itemCount: 3,
    subtotal: "449.70",
    pending: false,
    mutating: false,
    canCheckout: true,
    retrying: false,
    onCheckout: () => undefined,
  },
  decorators: [
    (Story) => <div style={{ maxWidth: 390 }}><Story /></div>,
  ],
} satisfies Meta<typeof CheckoutSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Processing: Story = {
  args: { mutating: true },
};

export const SafeRetry: Story = {
  args: { canCheckout: false, retrying: true },
};

export const Unavailable: Story = {
  args: { canCheckout: false },
};

export const Success: Story = {
  render: () => (
    <div style={{ width: "min(900px, 90vw)" }}>
      <CheckoutSuccess order={order} />
    </div>
  ),
};
