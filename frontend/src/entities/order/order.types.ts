import type { SellerReference } from "../product/product.types";

export type OrderStatus =
  | "NEW"
  | "PROCESSING"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "PARTIALLY_CANCELLED"
  | "CANCELLED";
export type SellerOrderStatus =
  | "NEW"
  | "PROCESSING"
  | "SHIPPED"
  | "COMPLETED"
  | "PARTIALLY_CANCELLED"
  | "CANCELLED";

export interface CustomerOrderItem {
  id: string;
  productId: string;
  productTitle: string;
  productImageUrl: string | null;
  productType: string;
  sellerNameSnapshot: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  cancelledQuantity: number;
  refundedQuantity: number;
  refundedAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSellerOrder {
  id: string;
  status: SellerOrderStatus;
  currency: string;
  grossAmount: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  seller: SellerReference;
  items: CustomerOrderItem[];
}

export interface CustomerOrder {
  id: string;
  status: OrderStatus;
  currency: string;
  totalAmount: string;
  refundedAmount: string;
  createdAt: string;
  updatedAt: string;
  sellerOrders: CustomerSellerOrder[];
}

export interface OrdersResponse {
  items: CustomerOrder[];
  page: number;
  pageSize: number;
  total: number;
}
export interface Dispute {
  id: string;
  orderId: string;
  sellerOrderId: string;
  orderItemId: string | null;
  status: string;
  reason: string;
  createdAt: string;
}
