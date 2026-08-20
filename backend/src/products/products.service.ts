import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  ProductStatus,
  ProductType,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CatalogCacheService } from '../cache/catalog-cache.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import {
  PRODUCT_ARCHIVED,
  PRODUCT_CREATED,
  PRODUCT_UNPUBLISHED,
  PRODUCT_UPDATED,
  ProductEventsService,
} from '../search/product-events.service.js';

const productInclude = {
  category: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ProductEventsService,
    private readonly cache: CatalogCacheService,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateProductDto,
    correlationId: string,
  ) {
    const seller = await this.getApprovedSeller(user.id);
    await this.assertCategory(dto.categoryId);
    this.assertPriceForType(dto.type, dto.price);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            sellerId: seller.id,
            categoryId: dto.categoryId,
            title: dto.title,
            description: dto.description,
            imageUrl: dto.imageUrl,
            type: dto.type,
            price:
              dto.type === ProductType.FIXED_PRICE
                ? new Prisma.Decimal(dto.price!)
                : null,
            stock: dto.stock,
            status: ProductStatus.DRAFT,
          },
          include: productInclude,
        });
        await this.events.emit(
          tx,
          PRODUCT_CREATED,
          created.id,
          correlationId,
          created.updatedAt,
        );
        return created;
      });
      await this.cache.invalidateProduct(product.id);
      return product;
    } catch (error) {
      this.handleCategoryReference(error);
    }
  }

  async listOwn(user: AuthenticatedUser) {
    const seller = await this.getApprovedSeller(user.id);

    return this.prisma.product.findMany({
      where: { sellerId: seller.id },
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOwn(user: AuthenticatedUser, id: string) {
    const seller = await this.getApprovedSeller(user.id);
    return this.getOwnedProduct(id, seller.id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProductDto,
    correlationId: string,
  ) {
    const seller = await this.getApprovedSeller(user.id);
    const product = await this.getOwnedProduct(id, seller.id);

    if (product.type === ProductType.AUCTION && dto.price !== undefined) {
      throw new BadRequestException(
        'Auction Product price is configured through Auction',
      );
    }

    if (
      product.status !== ProductStatus.DRAFT &&
      product.status !== ProductStatus.REJECTED
    ) {
      throw new ConflictException(
        `Product cannot be edited while ${product.status}`,
      );
    }

    if (dto.categoryId) {
      await this.assertCategory(dto.categoryId);
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.product.update({
          where: { id: product.id },
          data: {
            categoryId: dto.categoryId,
            title: dto.title,
            description: dto.description,
            imageUrl: dto.imageUrl,
            price:
              dto.price === undefined
                ? undefined
                : new Prisma.Decimal(dto.price),
            stock: dto.stock,
            status:
              product.status === ProductStatus.REJECTED
                ? ProductStatus.DRAFT
                : undefined,
            moderatedById:
              product.status === ProductStatus.REJECTED ? null : undefined,
            moderatedAt:
              product.status === ProductStatus.REJECTED ? null : undefined,
            rejectionReason:
              product.status === ProductStatus.REJECTED ? null : undefined,
          },
          include: productInclude,
        });
        await this.events.emit(
          tx,
          PRODUCT_UPDATED,
          result.id,
          correlationId,
          result.updatedAt,
        );
        return result;
      });
      await this.cache.invalidateProduct(updated.id);
      return updated;
    } catch (error) {
      this.handleCategoryReference(error);
    }
  }

  async requestPublication(
    user: AuthenticatedUser,
    id: string,
    correlationId: string,
  ) {
    const seller = await this.getApprovedSeller(user.id);
    const product = await this.getOwnedProduct(id, seller.id);

    if (product.type === ProductType.AUCTION) {
      const auction = await this.prisma.auction.findUnique({
        where: { productId: product.id },
        select: { id: true },
      });
      if (!auction) {
        throw new ConflictException(
          'Auction Product must be configured before publication',
        );
      }
    }

    if (
      product.status !== ProductStatus.DRAFT &&
      product.status !== ProductStatus.REJECTED
    ) {
      throw new ConflictException(
        `Product cannot request publication while ${product.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.product.updateMany({
        where: {
          id: product.id,
          sellerId: seller.id,
          status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
        },
        data: {
          status: ProductStatus.PENDING_REVIEW,
          moderatedById: null,
          moderatedAt: null,
          rejectionReason: null,
        },
      });

      if (transitioned.count !== 1) {
        throw new ConflictException('Product state changed concurrently');
      }
      const updated = await tx.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      await this.events.emit(
        tx,
        PRODUCT_UNPUBLISHED,
        updated.id,
        correlationId,
        updated.updatedAt,
      );
    });
    await this.cache.invalidateProduct(product.id);
    return this.getOwnedProduct(product.id, seller.id);
  }

  async archive(user: AuthenticatedUser, id: string, correlationId: string) {
    const seller = await this.getApprovedSeller(user.id);
    const product = await this.getOwnedProduct(id, seller.id);

    if (product.status === ProductStatus.ARCHIVED) {
      return product;
    }

    await this.prisma.$transaction(async (tx) => {
      const archived = await tx.product.update({
        where: { id: product.id },
        data: { status: ProductStatus.ARCHIVED },
      });
      await this.events.emit(
        tx,
        PRODUCT_ARCHIVED,
        archived.id,
        correlationId,
        archived.updatedAt,
      );
    });
    await this.cache.invalidateProduct(product.id);
    return this.getOwnedProduct(product.id, seller.id);
  }

  private async getApprovedSeller(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: { user: { select: { role: true } } },
    });

    if (!seller || seller.user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Approved Seller profile required');
    }

    return seller;
  }

  private async getOwnedProduct(id: string, sellerId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, sellerId },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private handleCategoryReference(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new NotFoundException('Category not found');
    }

    throw error;
  }

  private assertPriceForType(type: ProductType, price?: string): void {
    if (type === ProductType.FIXED_PRICE && price === undefined) {
      throw new BadRequestException('FIXED_PRICE Product requires price');
    }
    if (type === ProductType.AUCTION && price !== undefined) {
      throw new BadRequestException(
        'Auction Product price is configured through Auction',
      );
    }
  }
}
