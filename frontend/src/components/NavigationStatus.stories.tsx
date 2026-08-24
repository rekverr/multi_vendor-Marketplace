import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderStatusBadge } from "../entities/order/OrderStatusBadge";
import { Pagination } from "../features/catalog/Pagination";

function PaginationExample() {
  const [page, setPage] = useState(3);
  return <Pagination page={page} totalPages={9} onPage={setPage} />;
}
const meta = {
  title: "Foundations/Navigation and Status",
  component: PaginationExample,
} satisfies Meta<typeof PaginationExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InteractivePagination: Story = {};
export const LifecycleBadges: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <OrderStatusBadge status="NEW" />
      <OrderStatusBadge status="PROCESSING" />
      <OrderStatusBadge status="SHIPPED" />
      <OrderStatusBadge status="COMPLETED" />
      <OrderStatusBadge status="PARTIALLY_CANCELLED" />
      <OrderStatusBadge status="CANCELLED" />
    </div>
  ),
};
