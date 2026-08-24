import type { Meta, StoryObj } from "@storybook/react-vite";
import { CardSkeletons, EmptyState, ErrorState } from "./AsyncState";
import { PageLoader } from "./PageLoader";

const meta = {
  title: "Foundations/Async States",
  component: ErrorState,
  args: { message: "Request failed." },
} satisfies Meta<typeof ErrorState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LoadingPage: Story = {
  render: () => <PageLoader label="Restoring authenticated session" />,
};
export const LoadingCards: Story = { render: () => <CardSkeletons /> };
export const ErrorWithRetry: Story = {
  args: {
    message:
      "Search is temporarily unavailable. PostgreSQL state was not affected.",
    onRetry: () => undefined,
  },
};
export const Empty: Story = {
  render: () => (
    <EmptyState title="No SellerOrders">
      New Customer purchases will appear here after authoritative checkout.
    </EmptyState>
  ),
};
