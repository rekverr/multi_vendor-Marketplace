import { Injectable } from '@nestjs/common';
import { ProductStatus, UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';

@Injectable()
export class RealtimeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canReadProduct(productId: string): Promise<boolean> {
    return Boolean(
      await this.prisma.product.findFirst({
        where: { id: productId, status: ProductStatus.PUBLISHED },
        select: { id: true },
      }),
    );
  }

  async canReadAuction(auctionId: string): Promise<boolean> {
    return Boolean(
      await this.prisma.auction.findFirst({
        where: {
          id: auctionId,
          product: { status: ProductStatus.PUBLISHED },
        },
        select: { id: true },
      }),
    );
  }

  async canReadOrder(user: AuthenticatedUser, orderId: string) {
    if (user.role !== UserRole.CUSTOMER) return null;
    return this.prisma.order.findFirst({
      where: { id: orderId, customerId: user.id },
      select: { id: true, updatedAt: true },
    });
  }

  async canReadSellerOrder(user: AuthenticatedUser, sellerOrderId: string) {
    if (user.role === UserRole.CUSTOMER) {
      return this.prisma.sellerOrder.findFirst({
        where: { id: sellerOrderId, order: { customerId: user.id } },
        select: { id: true, orderId: true, updatedAt: true },
      });
    }
    if (user.role === UserRole.SELLER) {
      return this.prisma.sellerOrder.findFirst({
        where: { id: sellerOrderId, seller: { userId: user.id } },
        select: { id: true, orderId: true, updatedAt: true },
      });
    }
    return null;
  }
}
