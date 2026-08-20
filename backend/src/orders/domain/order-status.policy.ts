import {
  OrderStatus,
  SellerOrderStatus,
} from '../../generated/prisma/client.js';

const SELLER_ORDER_TRANSITIONS: Record<SellerOrderStatus, SellerOrderStatus[]> =
  {
    [SellerOrderStatus.NEW]: [
      SellerOrderStatus.PROCESSING,
      SellerOrderStatus.CANCELLED,
      SellerOrderStatus.PARTIALLY_CANCELLED,
    ],
    [SellerOrderStatus.PROCESSING]: [
      SellerOrderStatus.SHIPPED,
      SellerOrderStatus.CANCELLED,
      SellerOrderStatus.PARTIALLY_CANCELLED,
    ],
    [SellerOrderStatus.SHIPPED]: [SellerOrderStatus.COMPLETED],
    [SellerOrderStatus.COMPLETED]: [],
    [SellerOrderStatus.PARTIALLY_CANCELLED]: [
      SellerOrderStatus.PROCESSING,
      SellerOrderStatus.SHIPPED,
      SellerOrderStatus.CANCELLED,
    ],
    [SellerOrderStatus.CANCELLED]: [],
  };

export function canTransitionSellerOrder(
  from: SellerOrderStatus,
  to: SellerOrderStatus,
): boolean {
  return from === to || SELLER_ORDER_TRANSITIONS[from].includes(to);
}

export function deriveOrderStatus(statuses: SellerOrderStatus[]): OrderStatus {
  if (statuses.length === 0) {
    throw new RangeError('Order must contain at least one SellerOrder');
  }
  if (statuses.every((status) => status === SellerOrderStatus.CANCELLED)) {
    return OrderStatus.CANCELLED;
  }
  if (statuses.some((status) => status === SellerOrderStatus.CANCELLED)) {
    return OrderStatus.PARTIALLY_CANCELLED;
  }
  if (statuses.every((status) => status === SellerOrderStatus.COMPLETED)) {
    return OrderStatus.COMPLETED;
  }
  if (statuses.some((status) => status === SellerOrderStatus.COMPLETED)) {
    return OrderStatus.PARTIALLY_COMPLETED;
  }
  if (statuses.every((status) => status === SellerOrderStatus.SHIPPED)) {
    return OrderStatus.SHIPPED;
  }
  if (statuses.some((status) => status === SellerOrderStatus.SHIPPED)) {
    return OrderStatus.PARTIALLY_SHIPPED;
  }
  if (
    statuses.some(
      (status) =>
        status === SellerOrderStatus.PROCESSING ||
        status === SellerOrderStatus.PARTIALLY_CANCELLED,
    )
  ) {
    return OrderStatus.PROCESSING;
  }
  return OrderStatus.NEW;
}
