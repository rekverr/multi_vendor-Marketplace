import type { OrderStatus } from "../../entities/order/order.types";
import type {
  NamedReference,
  Pagination,
  ProductType,
  SellerReference,
} from "../../entities/product/product.types";
import type { ProductStatus } from "../seller/seller.types";

export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface SellerApplication {
  id: string;
  userId: string;
  displayName: string;
  status: ApplicationStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  user: { id: string; email: string; role: string };
  reviewedBy: { id: string; email: string } | null;
}
export interface AdminCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export interface AdminProduct {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  type: ProductType;
  price: string | null;
  stock: number;
  status: ProductStatus;
  rejectionReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: NamedReference;
  seller: SellerReference;
  moderatedBy: { id: string; email: string } | null;
}
export type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "REJECTED"
  | "CLOSED";
export interface AdminDispute {
  id: string;
  customerId: string;
  orderId: string;
  sellerOrderId: string;
  orderItemId: string | null;
  status: DisputeStatus;
  reason: string;
  resolutionNote: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sellerOrder: { sellerId: string; status: string };
  orderItem: {
    id: string;
    productId: string;
    productTitle: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  } | null;
}
export interface DisputesResponse {
  items: AdminDispute[];
  pagination: Pagination;
}
export interface AdminAnalytics {
  range: { from: string; to: string };
  definitions: Record<string, string>;
  financials: Array<{
    currency: string;
    orderCount: number;
    bookedGross: string;
    refundedGross: string;
    totalRevenue: string;
    platformRevenue: string;
    sellerRevenue: string;
  }>;
  orderStatusSummary: Array<{
    currency: string;
    status: OrderStatus;
    count: number;
  }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    currency: string;
    netUnits: number;
    netGross: string;
  }>;
  topSellers: Array<{
    sellerId: string;
    sellerName: string;
    currency: string;
    recognizedRevenue: string;
  }>;
  dailySales: Array<{
    day: string;
    currency: string;
    orderCount: number;
    netGross: string;
  }>;
  previousPeriod: {
    range: { from: string; to: string };
    sales: Array<{ currency: string; orderCount: number; netGross: string }>;
  };
  periodComparison: Array<{
    currency: string;
    currentNetGross: string;
    previousNetGross: string;
    delta: string;
    percentChange: string | null;
  }>;
  conversion: { available: false; reason: string };
}
