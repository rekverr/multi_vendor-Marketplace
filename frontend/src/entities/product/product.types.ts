export type ProductType = "FIXED_PRICE" | "AUCTION";
export type AuctionStatus =
  | "SCHEDULED"
  | "ACTIVE"
  | "ENDED"
  | "SOLD"
  | "UNSOLD"
  | "CANCELLED";

export interface ProductReference {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  stock: number;
}
export interface NamedReference {
  id: string;
  name: string;
}
export interface SellerReference {
  id: string;
  displayName: string;
}

export interface PublicProduct extends ProductReference {
  type: ProductType;
  price: string | null;
  ratingAverage: string;
  ratingCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: NamedReference;
  seller: SellerReference;
  auction: { id: string; status: AuctionStatus } | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface ProductListResponse {
  items: PublicProduct[];
  facets: Record<string, Record<string, number>>;
  pagination: Pagination;
}

export interface ProductReview {
  id: string;
  productId: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewsResponse {
  items: ProductReview[];
  ratingAverage: string;
  ratingCount: number;
  pagination: Pagination;
}

export interface PublicBid {
  id: string;
  amount: string;
  createdAt: string;
}
export interface PublicAuction {
  id: string;
  status: AuctionStatus;
  startingPrice: string;
  minimumIncrement: string;
  startsAt: string;
  endsAt: string;
  version: number;
  winningPrice: string | null;
  winnerCheckoutExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: ProductReference & {
    seller: SellerReference;
    category: NamedReference;
  };
  currentHighestBid: PublicBid | null;
  bids: PublicBid[];
  bidCount: number;
}
