import { apiRequest } from "../../api/client";
import type { NamedReference } from "../../entities/product/product.types";
import type {
  ProductInput,
  SellerAuction,
  SellerDashboard,
  SellerOrder,
  SellerOrdersResponse,
  SellerProduct,
} from "./seller.types";

export const sellerApi = {
  apply(displayName: string): Promise<unknown> {
    return apiRequest("/seller-applications", {
      method: "POST",
      authenticated: true,
      body: { displayName },
    });
  },
  categories(signal?: AbortSignal): Promise<NamedReference[]> {
    return apiRequest("/categories", { signal });
  },
  products(signal?: AbortSignal): Promise<SellerProduct[]> {
    return apiRequest("/seller/products", { authenticated: true, signal });
  },
  product(id: string, signal?: AbortSignal): Promise<SellerProduct> {
    return apiRequest(`/seller/products/${id}`, {
      authenticated: true,
      signal,
    });
  },
  createProduct(input: ProductInput): Promise<SellerProduct> {
    return apiRequest("/seller/products", {
      method: "POST",
      authenticated: true,
      body: input,
    });
  },
  updateProduct(
    id: string,
    input: Partial<ProductInput>,
  ): Promise<SellerProduct> {
    return apiRequest(`/seller/products/${id}`, {
      method: "PATCH",
      authenticated: true,
      body: input,
    });
  },
  requestPublication(id: string): Promise<SellerProduct> {
    return apiRequest(`/seller/products/${id}/request-publication`, {
      method: "PATCH",
      authenticated: true,
      body: {},
    });
  },
  archiveProduct(id: string): Promise<SellerProduct> {
    return apiRequest(`/seller/products/${id}`, {
      method: "DELETE",
      authenticated: true,
    });
  },
  auction(productId: string, signal?: AbortSignal): Promise<SellerAuction> {
    return apiRequest(`/seller/products/${productId}/auction`, {
      authenticated: true,
      signal,
    });
  },
  configureAuction(
    productId: string,
    input: {
      startingPrice: string;
      minimumIncrement: string;
      startsAt: string;
      endsAt: string;
    },
  ): Promise<SellerAuction> {
    return apiRequest(`/seller/products/${productId}/auction`, {
      method: "PUT",
      authenticated: true,
      body: input,
    });
  },
  orders(page: number, signal?: AbortSignal): Promise<SellerOrdersResponse> {
    return apiRequest(`/seller/orders?page=${page}&pageSize=20`, {
      authenticated: true,
      signal,
    });
  },
  order(id: string, signal?: AbortSignal): Promise<SellerOrder> {
    return apiRequest(`/seller/orders/${id}`, { authenticated: true, signal });
  },
  transitionOrder(id: string, status: string): Promise<SellerOrder> {
    return apiRequest(`/seller/orders/${id}/status`, {
      method: "PATCH",
      authenticated: true,
      body: { status },
    });
  },
  dashboard(
    from?: string,
    to?: string,
    signal?: AbortSignal,
  ): Promise<SellerDashboard> {
    const query = new URLSearchParams();
    if (from)
      query.set("from", new Date(`${from}T00:00:00.000Z`).toISOString());
    if (to) query.set("to", new Date(`${to}T23:59:59.999Z`).toISOString());
    return apiRequest(`/seller/dashboard?${query}`, {
      authenticated: true,
      signal,
    });
  },
};
