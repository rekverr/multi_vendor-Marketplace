import type {
  CustomerOrderItem,
  SellerOrderStatus,
} from "../../entities/order/order.types";
import type {
  AuctionStatus,
  NamedReference,
  ProductType,
} from "../../entities/product/product.types";

export type ProductStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";
export interface SellerProduct {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  type: ProductType;
  price: string | null;
  stock: number;
  status: ProductStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  category: NamedReference;
}
export interface ProductInput {
  categoryId: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  type: ProductType;
  price?: string;
  stock: number;
}
export interface SellerAuction {
  id: string;
  productId: string;
  status: AuctionStatus;
  startingPrice: string;
  minimumIncrement: string;
  startsAt: string;
  endsAt: string;
  winningPrice?: string | null;
  winnerCheckoutExpiresAt?: string | null;
  _count: { bids: number };
}
export interface SellerOrder {
  id: string;
  orderId: string;
  status: SellerOrderStatus;
  currency: string;
  grossAmount: string;
  commissionRate: string;
  platformCommission: string;
  sellerNet: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  items: CustomerOrderItem[];
}
export interface SellerOrdersResponse {
  items: SellerOrder[];
  page: number;
  pageSize: number;
  total: number;
}
export interface SellerDashboard {
  seller: { id: string; displayName: string };
  range: { from: string; to: string };
  definitions: Record<string, string>;
  financials: Array<{
    currency: string;
    orderCount: number;
    bookedGross: string;
    refundedGross: string;
    netGrossSales: string;
    platformCommission: string;
    refundedCommission: string;
    bookedSellerNet: string;
    refundedSellerNet: string;
    recognizedSellerRevenue: string;
  }>;
  orderStatusSummary: Array<{
    currency: string;
    status: SellerOrderStatus;
    count: number;
  }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    currency: string;
    purchasedUnits: number;
    cancelledUnits: number;
    refundedUnits: number;
    netUnits: number;
    netGross: string;
  }>;
  recentSellerOrders: Array<
    Omit<
      SellerOrder,
      "items" | "commissionRate" | "platformCommission" | "completedAt"
    > & { refundedGross: string; refundedSellerNet: string; itemCount: number }
  >;
}
