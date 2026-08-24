import { apiDownload, apiRequest } from "../../api/client";
import type {
  AdminAnalytics,
  AdminCategory,
  AdminDispute,
  AdminProduct,
  ApplicationStatus,
  DisputeStatus,
  DisputesResponse,
  SellerApplication,
} from "./admin.types";
import type { ProductStatus } from "../seller/seller.types";

function rangeQuery(from?: string, to?: string): string {
  const query = new URLSearchParams();
  if (from) query.set("from", new Date(`${from}T00:00:00.000Z`).toISOString());
  if (to) query.set("to", new Date(`${to}T23:59:59.999Z`).toISOString());
  return query.toString();
}
export const adminApi = {
  applications(
    status?: ApplicationStatus,
    signal?: AbortSignal,
  ): Promise<SellerApplication[]> {
    return apiRequest(
      `/seller-applications${status ? `?status=${status}` : ""}`,
      { authenticated: true, signal },
    );
  },
  approveApplication(id: string): Promise<SellerApplication> {
    return apiRequest(`/seller-applications/${id}/approve`, {
      method: "PATCH",
      authenticated: true,
      body: {},
    });
  },
  rejectApplication(id: string, reason: string): Promise<SellerApplication> {
    return apiRequest(`/seller-applications/${id}/reject`, {
      method: "PATCH",
      authenticated: true,
      body: { reason },
    });
  },
  categories(signal?: AbortSignal): Promise<AdminCategory[]> {
    return apiRequest("/categories", { signal });
  },
  createCategory(name: string): Promise<AdminCategory> {
    return apiRequest("/categories", {
      method: "POST",
      authenticated: true,
      body: { name },
    });
  },
  updateCategory(id: string, name: string): Promise<AdminCategory> {
    return apiRequest(`/categories/${id}`, {
      method: "PATCH",
      authenticated: true,
      body: { name },
    });
  },
  deleteCategory(id: string): Promise<void> {
    return apiRequest(`/categories/${id}`, {
      method: "DELETE",
      authenticated: true,
    });
  },
  products(
    status: ProductStatus = "PENDING_REVIEW",
    signal?: AbortSignal,
  ): Promise<AdminProduct[]> {
    return apiRequest(`/admin/products?status=${status}`, {
      authenticated: true,
      signal,
    });
  },
  approveProduct(id: string): Promise<AdminProduct> {
    return apiRequest(`/admin/products/${id}/approve`, {
      method: "PATCH",
      authenticated: true,
      body: {},
    });
  },
  rejectProduct(id: string, reason: string): Promise<AdminProduct> {
    return apiRequest(`/admin/products/${id}/reject`, {
      method: "PATCH",
      authenticated: true,
      body: { reason },
    });
  },
  disputes(
    page: number,
    status?: DisputeStatus,
    signal?: AbortSignal,
  ): Promise<DisputesResponse> {
    const query = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status) query.set("status", status);
    return apiRequest(`/admin/disputes?${query}`, {
      authenticated: true,
      signal,
    });
  },
  dispute(id: string, signal?: AbortSignal): Promise<AdminDispute> {
    return apiRequest(`/admin/disputes/${id}`, { authenticated: true, signal });
  },
  transitionDispute(
    id: string,
    status: DisputeStatus,
    resolutionNote?: string,
  ): Promise<AdminDispute> {
    return apiRequest(`/admin/disputes/${id}/status`, {
      method: "PATCH",
      authenticated: true,
      body: { status, ...(resolutionNote ? { resolutionNote } : {}) },
    });
  },
  analytics(
    from?: string,
    to?: string,
    signal?: AbortSignal,
  ): Promise<AdminAnalytics> {
    return apiRequest(`/admin/analytics?${rangeQuery(from, to)}`, {
      authenticated: true,
      signal,
    });
  },
  salesCsv(from?: string, to?: string) {
    return apiDownload(`/admin/analytics/sales.csv?${rangeQuery(from, to)}`);
  },
  salesJson(from?: string, to?: string) {
    return apiDownload(`/admin/analytics/sales.json?${rangeQuery(from, to)}`);
  },
};
