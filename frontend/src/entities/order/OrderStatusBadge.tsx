import type { OrderStatus, SellerOrderStatus } from "./order.types";

export function OrderStatusBadge({
  status,
}: {
  status: OrderStatus | SellerOrderStatus;
}) {
  return (
    <span
      className={`order-status status-${status.toLowerCase().replaceAll("_", "-")}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
