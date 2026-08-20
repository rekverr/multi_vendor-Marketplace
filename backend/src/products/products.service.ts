import {
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
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

const productInclude = {
  category: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateProductDto) {
    const seller = await this.getApprovedSeller(user.id);
    await this.assertCategory(dto.categoryId);

    try {
      return await this.prisma.product.create({
        data: {
          sellerId: seller.id,
          categoryId: dto.categoryId,
          title: dto.title,
          description: dto.description,
          imageUrl: dto.imageUrl,
          type: ProductType.FIXED_PRICE,
          price: new Prisma.Decimal(dto.price),
          stock: dto.stock,
          status: ProductStatus.DRAFT,
        },
        include: productInclude,
      });
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

  async update(user: AuthenticatedUser, id: string, dto: UpdateProductDto) {
    const seller = await this.getApprovedSeller(user.id);
    const product = await this.getOwnedProduct(id, seller.id);

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
      return await this.prisma.product.update({
        where: { id: product.id },
        data: {
          categoryId: dto.categoryId,
          title: dto.title,
          description: dto.description,
          imageUrl: dto.imageUrl,
          price:
            dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
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
    } catch (error) {
      this.handleCategoryReference(error);
    }
  }

  async requestPublication(user: AuthenticatedUser, id: string) {
    const seller = await this.getApprovedSeller(user.id);
    const product = await this.getOwnedProduct(id, seller.id);

    if (
      product.status !== ProductStatus.DRAFT &&
      product.status !== ProductStatus.REJECTED
    ) {
      throw new ConflictException(
        `Product cannot request publication while ${product.status}`,
      );
    }

    const transitioned = await this.prisma.product.updateMany({
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

    return this.getOwnedProduct(product.id, seller.id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    const seller = await this.getApprovedSeller(user.id);
    const product = await this.getOwnedProduct(id, seller.id);

    if (product.status === ProductStatus.ARCHIVED) {
      return product;
    }

    await this.prisma.product.updateMany({
      where: { id: product.id, sellerId: seller.id },
      data: { status: ProductStatus.ARCHIVED },
    });

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
}
