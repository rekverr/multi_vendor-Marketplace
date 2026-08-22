import { apiRequest } from "../../api/client";
import type {
  PublicAuction,
  PublicBid,
} from "../../entities/product/product.types";

export const auctionsApi = {
  detail(id: string, signal?: AbortSignal): Promise<PublicAuction> {
    return apiRequest(`/auctions/${id}`, { signal });
  },
  bid(id: string, amount: string, idempotencyKey: string): Promise<PublicBid> {
    return apiRequest(`/auctions/${id}/bids`, {
      method: "POST",
      authenticated: true,
      headers: { "Idempotency-Key": idempotencyKey },
      body: { amount },
    });
  },
};
