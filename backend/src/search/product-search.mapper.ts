import { Prisma } from '../generated/prisma/client.js';
import { ProductSearchDocument } from './product-search.types.js';

export const searchProductSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  type: true,
  price: true,
  stock: true,
  ratingAverage: true,
  ratingCount: true,
  categoryId: true,
  sellerId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { name: true } },
  seller: { select: { displayName: true } },
} satisfies Prisma.ProductSelect;

type SearchProduct = Prisma.ProductGetPayload<{
  select: typeof searchProductSelect;
}>;

export function mapProductToSearchDocument(
  product: SearchProduct,
): ProductSearchDocument {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    imageUrl: product.imageUrl,
    type: product.type,
    price: product.price?.toNumber() ?? null,
    stock: product.stock,
    inStock: product.stock > 0,
    ratingAverage: product.ratingAverage.toNumber(),
    ratingCount: product.ratingCount,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    sellerId: product.sellerId,
    sellerName: product.seller.displayName,
    createdAt: product.createdAt.getTime(),
    publishedAt: product.publishedAt?.getTime() ?? 0,
    updatedAt: product.updatedAt.getTime(),
  };
}
