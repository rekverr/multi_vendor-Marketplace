import { ProductType } from '../generated/prisma/client.js';

export interface ProductSearchDocument {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  type: ProductType;
  price: number | null;
  stock: number;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
  categoryId: string;
  categoryName: string;
  sellerId: string;
  sellerName: string;
  createdAt: number;
  publishedAt: number;
  updatedAt: number;
}
