import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  ProductType,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

const cartInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          type: true,
          price: true,
          stock: true,
          status: true,
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, displayName: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.CartInclude;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: cartInclude,
    });
    return this.toResponse(cart);
  }

  async add(userId: string, productId: string, quantity: number) {
    await this.prisma.$transaction(async (tx) => {
      const product = await this.getPurchasableProduct(tx, productId);
      const cart = await tx.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: { id: true },
      });
      const item = await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity },
        update: { quantity: { increment: quantity } },
      });

      if (item.quantity > product.stock) {
        throw new ConflictException('Requested quantity exceeds current stock');
      }
    });

    return this.getCurrent(userId);
  }

  async update(userId: string, productId: string, quantity: number) {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: { productId, cart: { userId } },
        select: { id: true },
      });
      if (!item) throw new NotFoundException('Cart item not found');

      const product = await this.getPurchasableProduct(tx, productId);
      if (quantity > product.stock) {
        throw new ConflictException('Requested quantity exceeds current stock');
      }

      await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
    });

    return this.getCurrent(userId);
  }

  async remove(userId: string, productId: string) {
    const removed = await this.prisma.cartItem.deleteMany({
      where: { productId, cart: { userId } },
    });
    if (removed.count === 0) throw new NotFoundException('Cart item not found');
    return this.getCurrent(userId);
  }

  async clear(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
  }

  private async getPurchasableProduct(
    tx: Prisma.TransactionClient,
    productId: string,
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.PUBLISHED,
        type: ProductType.FIXED_PRICE,
        price: { not: null },
      },
      select: { id: true, stock: true },
    });

    if (!product || product.stock < 1) {
      throw new NotFoundException('Product is not available for cart');
    }
    return product;
  }

  private toResponse(
    cart: Prisma.CartGetPayload<{ include: typeof cartInclude }>,
  ) {
    const items = cart.items.map((item) => {
      const purchasable =
        item.product.status === ProductStatus.PUBLISHED &&
        item.product.type === ProductType.FIXED_PRICE &&
        item.product.price !== null &&
        item.product.stock >= item.quantity;
      return {
        id: item.id,
        quantity: item.quantity,
        lineTotal: item.product.price?.mul(item.quantity) ?? null,
        purchasable,
        product: {
          id: item.product.id,
          title: item.product.title,
          description: item.product.description,
          imageUrl: item.product.imageUrl,
          type: item.product.type,
          price: item.product.price,
          stock: item.product.stock,
          status: item.product.status,
          category: item.product.category,
          seller: item.product.seller,
        },
      };
    });
    const subtotal = items.reduce(
      (sum, item) => (item.lineTotal ? sum.add(item.lineTotal) : sum),
      new Prisma.Decimal(0),
    );

    return {
      id: cart.id,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
