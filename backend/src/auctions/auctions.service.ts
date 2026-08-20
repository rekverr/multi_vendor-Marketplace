import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuctionStatus,
  Prisma,
  ProductStatus,
  ProductType,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { ConfigureAuctionDto } from './dto/configure-auction.dto.js';

const sellerAuctionInclude = {
  product: {
    select: { id: true, title: true, type: true, status: true, stock: true },
  },
  _count: { select: { bids: true } },
} satisfies Prisma.AuctionInclude;

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async configure(userId: string, productId: string, dto: ConfigureAuctionDto) {
    const sellerId = await this.getApprovedSellerId(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      include: { auction: { include: { _count: { select: { bids: true } } } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.type !== ProductType.AUCTION) {
      throw new ConflictException('FIXED_PRICE Product cannot have an Auction');
    }
    if (
      product.status !== ProductStatus.DRAFT &&
      product.status !== ProductStatus.REJECTED
    ) {
      throw new ConflictException(
        `Auction cannot be configured while Product is ${product.status}`,
      );
    }
    if (product.stock !== 1) {
      throw new ConflictException('Auction Product stock must equal 1');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateTiming(startsAt, endsAt);
    const values = {
      startingPrice: new Prisma.Decimal(dto.startingPrice),
      minimumIncrement: new Prisma.Decimal(dto.minimumIncrement),
      startsAt,
      endsAt,
    };

    if (!product.auction) {
      return this.prisma.auction.create({
        data: {
          productId: product.id,
          status: AuctionStatus.SCHEDULED,
          ...values,
        },
        include: sellerAuctionInclude,
      });
    }
    if (
      product.auction.status !== AuctionStatus.SCHEDULED ||
      product.auction.startsAt <= new Date() ||
      product.auction._count.bids > 0
    ) {
      throw new ConflictException('Started Auction configuration is immutable');
    }
    return this.prisma.auction.update({
      where: { id: product.auction.id },
      data: values,
      include: sellerAuctionInclude,
    });
  }

  async getOwn(userId: string, productId: string) {
    const sellerId = await this.getApprovedSellerId(userId);
    const auction = await this.prisma.auction.findFirst({
      where: { productId, product: { sellerId } },
      include: sellerAuctionInclude,
    });
    if (!auction) throw new NotFoundException('Auction not found');
    return auction;
  }

  async getPublic(id: string) {
    const auction = await this.prisma.auction.findFirst({
      where: {
        id,
        status: { not: AuctionStatus.CANCELLED },
        product: { status: ProductStatus.PUBLISHED, type: ProductType.AUCTION },
      },
      select: {
        id: true,
        status: true,
        startingPrice: true,
        minimumIncrement: true,
        startsAt: true,
        endsAt: true,
        version: true,
        winningPrice: true,
        winnerCheckoutExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            stock: true,
            seller: { select: { id: true, displayName: true } },
            category: { select: { id: true, name: true } },
          },
        },
        currentHighestBid: {
          select: { id: true, amount: true, createdAt: true },
        },
        bids: {
          select: { id: true, amount: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        },
        _count: { select: { bids: true } },
      },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    const { _count, ...result } = auction;
    return { ...result, bidCount: _count.bids };
  }

  private async getApprovedSellerId(userId: string): Promise<string> {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: { user: { select: { role: true } } },
    });
    if (!seller || seller.user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Approved Seller profile required');
    }
    return seller.id;
  }

  private validateTiming(startsAt: Date, endsAt: Date): void {
    const now = Date.now();
    if (startsAt.getTime() <= now) {
      throw new BadRequestException('Auction start must be in the future');
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('Auction end must be after start');
    }
    if (endsAt.getTime() - startsAt.getTime() < 60_000) {
      throw new BadRequestException(
        'Auction duration must be at least 1 minute',
      );
    }
  }
}
