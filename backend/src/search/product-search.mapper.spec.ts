import { ProductType, Prisma } from '../generated/prisma/client.js';
import { mapProductToSearchDocument } from './product-search.mapper.js';

describe('mapProductToSearchDocument', () => {
  it('maps only searchable public Product fields', () => {
    const document = mapProductToSearchDocument({
      id: 'product-id',
      title: 'Mechanical Keyboard',
      description: 'Public description',
      imageUrl: 'https://example.com/product.jpg',
      type: ProductType.FIXED_PRICE,
      price: new Prisma.Decimal('19.99'),
      stock: 3,
      ratingAverage: new Prisma.Decimal('4.50'),
      ratingCount: 2,
      categoryId: 'category-id',
      sellerId: 'seller-id',
      publishedAt: new Date('2026-08-20T10:00:00.000Z'),
      createdAt: new Date('2026-08-19T10:00:00.000Z'),
      updatedAt: new Date('2026-08-20T11:00:00.000Z'),
      category: { name: 'Keyboards' },
      seller: { displayName: 'Keyboard Store' },
    });

    expect(document).toEqual(
      expect.objectContaining({
        id: 'product-id',
        price: 19.99,
        inStock: true,
        ratingAverage: 4.5,
        ratingCount: 2,
        categoryName: 'Keyboards',
        sellerName: 'Keyboard Store',
      }),
    );
    expect(document).not.toHaveProperty('userId');
    expect(document).not.toHaveProperty('moderatedById');
  });
});
