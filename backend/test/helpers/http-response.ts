import type { Response } from 'supertest';

export interface ApiResponseBody {
  id: string;
  title: string;
  createdAt: string;
  sellerId: string;
  accessToken: string;
  refreshToken: string;
  message: string | string[];
  name: string;
  role: string;
  status: string;
  orderStatus: string;
  reviewedAt: string;
  winnerId: string | null;
  winnerCheckoutExpiresAt: string | null;
  amount: string;
  commissionAmount: string;
  sellerNetAmount: string;
  price: string | null;
  quantity: number;
  totalAmount: string;
  currency: string;
  total: number;
  items: ApiResponseBody[];
  bids: ApiResponseBody[];
  sellerOrders: ApiResponseBody[];
  user: ApiResponseBody;
  seller: ApiResponseBody;
  category: ApiResponseBody;
  facets: Record<string, Record<string, number>>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function bodyOf<T = ApiResponseBody>(response: Response): T {
  const body: unknown = response.body;
  if (typeof body !== 'object' || body === null) {
    throw new TypeError('Expected a JSON response body');
  }
  return body as T;
}
