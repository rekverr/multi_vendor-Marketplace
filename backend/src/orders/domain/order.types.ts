import { Prisma, ProductType } from '../../generated/prisma/client.js';

export interface OrderItemSnapshot {
  productId: string;
  productTitle: string;
  productImageUrl: string | null;
  productType: ProductType;
  sellerIdSnapshot: string;
  sellerNameSnapshot: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  lineTotal: Prisma.Decimal;
}

export interface SellerOrderFinancials {
  grossAmount: Prisma.Decimal;
  commissionRate: Prisma.Decimal;
  platformCommission: Prisma.Decimal;
  sellerNet: Prisma.Decimal;
}
