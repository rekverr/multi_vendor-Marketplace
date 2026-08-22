import { apiRequest } from "../../api/client";
import type {
  CustomerOrder,
  Dispute,
  OrdersResponse,
} from "../../entities/order/order.types";

export const ordersApi = {
  list(page: number, signal?: AbortSignal): Promise<OrdersResponse> {
    return apiRequest(`/orders?page=${page}&pageSize=10`, {
      authenticated: true,
      signal,
    });
  },
  detail(orderId: string, signal?: AbortSignal): Promise<CustomerOrder> {
    return apiRequest(`/orders/${orderId}`, { authenticated: true, signal });
  },
  cancel(orderId: string): Promise<CustomerOrder> {
    return apiRequest(`/orders/${orderId}/cancel`, {
      method: "POST",
      authenticated: true,
      body: {},
    });
  },
  cancelSellerOrder(orderId: string, sellerOrderId: string): Promise<unknown> {
    return apiRequest(
      `/orders/${orderId}/seller-orders/${sellerOrderId}/cancel`,
      { method: "POST", authenticated: true, body: {} },
    );
  },
  dispute(
    orderId: string,
    input: { sellerOrderId: string; orderItemId?: string; reason: string },
  ): Promise<Dispute> {
    return apiRequest(`/orders/${orderId}/disputes`, {
      method: "POST",
      authenticated: true,
      body: input,
    });
  },
};
