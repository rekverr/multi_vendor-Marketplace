import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  SellerOrderStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PRODUCT_UPDATED } from '../search/product-events.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';

const reviewSelect = {
  id: true,
  productId: true,
  rating: true,
  text: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async create(
    customerId: string,
    productId: string,
    dto: CreateReviewDto,
    correlationId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockProduct(tx, productId);
        const eligibleItem = await tx.orderItem.findFirst({
          where: {
            id: dto.orderItemId,
            productId,
            quantity: { gt: 0 },
            sellerOrder: {
              status: SellerOrderStatus.COMPLETED,
              order: { customerId },
            },
          },
          select: { id: true, quantity: true, cancelledQuantity: true },
        });
        if (
          !eligibleItem ||
          eligibleItem.cancelledQuantity >= eligibleItem.quantity
        ) {
          throw new NotFoundException('Eligible completed purchase not found');
        }
        const review = await tx.review.create({
          data: {
            customerId,
            productId,
            orderItemId: eligibleItem.id,
            rating: dto.rating,
            text: dto.text,
          },
          select: reviewSelect,
        });
        await this.refreshAggregate(tx, productId, correlationId);
        return review;
      });
    } catch (error) {
      if (this.isDuplicate(error)) {
        throw new ConflictException('Product already reviewed');
      }
      throw error;
    }
  }

  async list(productId: string, query: ListReviewsQueryDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.PUBLISHED },
      select: { ratingAverage: true, ratingCount: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { productId },
        select: reviewSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);
    return {
      items,
      ratingAverage: product.ratingAverage,
      ratingCount: product.ratingCount,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async update(
    customerId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    correlationId: string,
  ) {
    if (dto.rating === undefined && dto.text === undefined) {
      throw new BadRequestException('At least one review field is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.review.findFirst({
        where: { id: reviewId, customerId },
        select: { productId: true },
      });
      if (!owned) throw new NotFoundException('Review not found');
      await this.lockProduct(tx, owned.productId);
      const review = await tx.review.update({
        where: { id: reviewId },
        data: dto,
        select: reviewSelect,
      });
      await this.refreshAggregate(tx, owned.productId, correlationId);
      return review;
    });
  }

  async remove(customerId: string, reviewId: string, correlationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.review.findFirst({
        where: { id: reviewId, customerId },
        select: { productId: true },
      });
      if (!owned) throw new NotFoundException('Review not found');
      await this.lockProduct(tx, owned.productId);
      await tx.review.delete({ where: { id: reviewId } });
      await this.refreshAggregate(tx, owned.productId, correlationId);
      return { deleted: true };
    });
  }

  private async refreshAggregate(
    tx: Prisma.TransactionClient,
    productId: string,
    correlationId: string,
  ): Promise<void> {
    const aggregate = await tx.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const product = await tx.product.update({
      where: { id: productId },
      data: {
        ratingAverage: new Prisma.Decimal(aggregate._avg.rating ?? 0),
        ratingCount: aggregate._count.rating,
      },
      select: { updatedAt: true },
    });
    await this.outbox.create(tx, {
      eventType: PRODUCT_UPDATED,
      aggregateType: 'Product',
      aggregateId: productId,
      correlationId,
      payload: {
        productId,
        reason: 'RATING_CHANGED',
        updatedAt: product.updatedAt.toISOString(),
      },
    });
  }

  private async lockProduct(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE
    `);
    if (!rows[0]) throw new NotFoundException('Product not found');
  }

  private isDuplicate(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
