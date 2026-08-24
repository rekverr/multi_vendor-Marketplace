import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PublicAuction } from "../../entities/product/product.types";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { BidForm } from "./BidForm";

const auction: PublicAuction = {
  id: "auction-1",
  status: "ACTIVE",
  startingPrice: "1000.00",
  minimumIncrement: "25.00",
  startsAt: "2026-08-24T09:00:00.000Z",
  endsAt: "2026-08-25T09:00:00.000Z",
  version: 3,
  winningPrice: null,
  winnerCheckoutExpiresAt: null,
  createdAt: "2026-08-23T09:00:00.000Z",
  updatedAt: "2026-08-24T09:30:00.000Z",
  product: {
    id: "product-1",
    title: "Numbered studio chair",
    description: "A limited workshop edition.",
    imageUrl: null,
    stock: 1,
    seller: { id: "seller-1", displayName: "North Workshop" },
    category: { id: "category-1", name: "Furniture" },
  },
  currentHighestBid: { id: "bid-1", amount: "1050.00", createdAt: "2026-08-24T09:30:00.000Z" },
  bids: [],
  bidCount: 3,
};

const customerAuth: AuthContextValue = {
  status: "authenticated",
  user: { id: "customer-1", email: "customer@example.com", role: "CUSTOMER" },
  login: async () => undefined,
  register: async () => undefined,
  completeGoogleLogin: async () => undefined,
  logout: async () => undefined,
  hasRole: (...roles) => roles.includes("CUSTOMER"),
  getAccessToken: () => "storybook-access-token",
};

function withAuth(value: AuthContextValue, children: ReactNode) {
  return <AuthContext value={value}>{children}</AuthContext>;
}

const meta = {
  title: "Auctions/BidForm",
  component: BidForm,
  args: {
    auction,
    deadlinePassed: false,
    onAccepted: async () => undefined,
  },
  decorators: [
    (Story) => <div style={{ maxWidth: 1050 }}><Story /></div>,
  ],
} satisfies Meta<typeof BidForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomerReady: Story = {
  render: (args) => withAuth(customerAuth, <BidForm {...args} />),
};

export const SignedOut: Story = {
  render: (args) =>
    withAuth(
      { ...customerAuth, status: "anonymous", user: null, getAccessToken: () => null },
      <BidForm {...args} />,
    ),
};

export const SellerRestricted: Story = {
  render: (args) =>
    withAuth(
      {
        ...customerAuth,
        user: { id: "seller-user-1", email: "seller@example.com", role: "SELLER" },
        hasRole: (...roles) => roles.includes("SELLER"),
      },
      <BidForm {...args} />,
    ),
};

export const Closed: Story = {
  args: { auction: { ...auction, status: "ENDED" }, deadlinePassed: true },
  render: (args) => withAuth(customerAuth, <BidForm {...args} />),
};
