import { apiRequest } from '../../api/client'
import type { NamedReference, ProductListResponse, PublicProduct, ReviewsResponse } from '../../entities/product/product.types'

export type CatalogSort = 'newest' | 'price_asc' | 'price_desc'

export interface CatalogQuery {
  q?: string
  page?: number
  pageSize?: number
  categoryId?: string
  sellerId?: string
  minPrice?: string
  maxPrice?: string
  available?: boolean
  sort?: CatalogSort
}

function queryString(query: CatalogQuery): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export const catalogApi = {
  list(query: CatalogQuery, signal?: AbortSignal): Promise<ProductListResponse> {
    return apiRequest(`/products?${queryString(query)}`, { signal })
  },
  product(id: string, signal?: AbortSignal): Promise<PublicProduct> {
    return apiRequest(`/products/${id}`, { signal })
  },
  reviews(productId: string, page = 1, signal?: AbortSignal): Promise<ReviewsResponse> {
    return apiRequest(`/products/${productId}/reviews?page=${page}&pageSize=6`, { signal })
  },
  categories(signal?: AbortSignal): Promise<NamedReference[]> {
    return apiRequest('/categories', { signal })
  },
}
