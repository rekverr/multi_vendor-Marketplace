import { apiRequest } from '../../api/client'
import type { PublicAuction } from '../../entities/product/product.types'

export const auctionsApi = {
  detail(id: string, signal?: AbortSignal): Promise<PublicAuction> {
    return apiRequest(`/auctions/${id}`, { signal })
  },
}
