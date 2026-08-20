import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuctionStatus,
  Prisma,
  ProductStatus,
  ProductType,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import {
  PRODUCT_UNPUBLISHED,
  ProductEventsService,
} from '../search/product-events.service.js';

interface LockedAuction {
  id: string;
  productId: string;
  status: AuctionStatus;
  startingPrice: Prisma.Decimal;
  minimumIncrement: Prisma.Decimal;
  startsAt: Date;
  endsAt: Date;
  currentHighestBidId: string | null;
  winnerCheckoutExpiresAt: Date | null;
  productStatus: ProductStatus;
  productType: ProductType;
  productStock: number;
  dbNow: Date;
}

const bidSelect = {
  id: true,
  auctionId: true,
  amount: true,
  createdAt: true,
} satisfies Prisma.BidSelect;

const commandAuctionSelect = {
  id: true,
  productId: true,
  status: true,
  startingPrice: true,
  minimumIncrement: true,
  startsAt: true,
  endsAt: true,
  version: true,
  currentHighestBidId: true,
  winnerId: true,
  winningPrice: true,
  winnerCheckoutExpiresAt: true,
  updatedAt: true,
} satisfies Prisma.AuctionSelect;

@Injectable()
export class AuctionCommandsService {
  private readonly logger = new Logger(AuctionCommandsService.name);
  private readonly winnerWindowSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly productEvents: ProductEventsService,
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.winnerWindowSeconds = config.getOrThrow<number>(
      'AUCTION_WINNER_CHECKOUT_WINDOW_SECONDS',
    );
  }

  async placeBid(
    customerId: string,
    auctionId: string,
    idempotencyKey: string,
    amountValue: string,
    correlationId: string,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const amount = new Prisma.Decimal(amountValue);
    const committed = await this.findBid(customerId, idempotencyKey);
    if (committed) return this.resolveBid(committed, auctionId, amount);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const customer = await tx.user.findFirst({
          where: { id: customerId, role: UserRole.CUSTOMER },
          select: { id: true },
        });
        if (!customer)
          throw new ConflictException('Eligible Customer required');

        const auction = await this.lockAuction(tx, auctionId);
        const existing = await tx.bid.findUnique({
          where: {
            bidderId_idempotencyKey: {
              bidderId: customerId,
              idempotencyKey,
            },
          },
          select: bidSelect,
        });
        if (existing) {
          if (
            existing.auctionId !== auctionId ||
            !existing.amount.equals(amount)
          ) {
            throw new ConflictException(
              'Idempotency key was used for another bid request',
            );
          }
          return { bid: existing, replayed: true };
        }

        this.assertBiddable(auction);
        if (auction.status === AuctionStatus.SCHEDULED) {
          await tx.auction.update({
            where: { id: auction.id },
            data: { status: AuctionStatus.ACTIVE },
          });
        }
        const highestBid = auction.currentHighestBidId
          ? await tx.bid.findUniqueOrThrow({
              where: { id: auction.currentHighestBidId },
              select: { amount: true },
            })
          : null;
        const minimumAmount = highestBid
          ? highestBid.amount.add(auction.minimumIncrement)
          : auction.startingPrice;
        if (amount.lessThan(minimumAmount)) {
          throw new ConflictException(
            `Bid must be at least ${minimumAmount.toFixed(2)}`,
          );
        }

        const bid = await tx.bid.create({
          data: {
            auctionId,
            bidderId: customerId,
            amount,
            idempotencyKey,
          },
          select: bidSelect,
        });
        const updated = await tx.auction.update({
          where: { id: auction.id },
          data: { currentHighestBidId: bid.id, version: { increment: 1 } },
          select: { version: true },
        });
        await this.outbox.create(tx, {
          eventType: 'AUCTION_BID_ACCEPTED',
          aggregateType: 'Auction',
          aggregateId: auction.id,
          correlationId,
          payload: {
            auctionId: auction.id,
            bidId: bid.id,
            amount: bid.amount.toFixed(2),
            version: updated.version,
          },
        });
        return { bid, replayed: false };
      });

      if (!result.replayed) {
        this.metrics.recordAuctionBidAccepted();
        this.logger.log({
          event: 'AUCTION_BID_ACCEPTED',
          auctionId,
          bidId: result.bid.id,
          correlationId,
        });
      }
      return result.bid;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const concurrent = await this.findBid(customerId, idempotencyKey);
        if (concurrent) return this.resolveBid(concurrent, auctionId, amount);
      }
      this.metrics.recordAuctionBidRejected();
      this.logger.warn({
        event: 'AUCTION_BID_REJECTED',
        auctionId,
        correlationId,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async finalize(auctionId: string, correlationId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const auction = await this.lockAuction(tx, auctionId);
      if (
        auction.status === AuctionStatus.SOLD ||
        auction.status === AuctionStatus.UNSOLD
      ) {
        return {
          auction: await this.getCommandAuction(tx, auction.id),
          changed: false,
        };
      }
      if (auction.status === AuctionStatus.CANCELLED) {
        throw new ConflictException('Cancelled Auction cannot be finalized');
      }
      if (auction.dbNow < auction.endsAt) {
        throw new ConflictException('Auction deadline has not passed');
      }

      const highestBid = auction.currentHighestBidId
        ? await tx.bid.findUniqueOrThrow({
            where: { id: auction.currentHighestBidId },
            select: { bidderId: true, amount: true },
          })
        : null;
      const winnerCheckoutExpiresAt = highestBid
        ? new Date(auction.dbNow.getTime() + this.winnerWindowSeconds * 1000)
        : null;
      const finalized = await tx.auction.update({
        where: { id: auction.id },
        data: highestBid
          ? {
              status: AuctionStatus.SOLD,
              winnerId: highestBid.bidderId,
              winningPrice: highestBid.amount,
              winnerCheckoutExpiresAt,
              version: { increment: 1 },
            }
          : {
              status: AuctionStatus.UNSOLD,
              version: { increment: 1 },
            },
        select: commandAuctionSelect,
      });
      await this.outbox.create(tx, {
        eventType: 'AUCTION_FINALIZED',
        aggregateType: 'Auction',
        aggregateId: auction.id,
        correlationId,
        payload: {
          auctionId: auction.id,
          status: finalized.status,
          winningPrice: finalized.winningPrice?.toFixed(2) ?? null,
          winnerCheckoutExpiresAt:
            finalized.winnerCheckoutExpiresAt?.toISOString() ?? null,
          version: finalized.version,
        },
      });
      return { auction: finalized, changed: true };
    });

    if (result.changed) {
      this.logger.log({
        event: 'AUCTION_FINALIZED',
        auctionId,
        status: result.auction.status,
        correlationId,
      });
    }
    return result.auction;
  }

  async expireWinnerWindow(auctionId: string, correlationId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const auction = await this.lockAuction(tx, auctionId);
      if (
        auction.status === AuctionStatus.UNSOLD &&
        auction.winnerCheckoutExpiresAt !== null
      ) {
        return {
          auction: await this.getCommandAuction(tx, auction.id),
          changed: false,
        };
      }
      if (
        auction.status !== AuctionStatus.SOLD ||
        !auction.winnerCheckoutExpiresAt
      ) {
        throw new ConflictException('Auction has no active winner window');
      }
      if (auction.dbNow <= auction.winnerCheckoutExpiresAt) {
        throw new ConflictException('Winner checkout window has not expired');
      }

      const expired = await tx.auction.update({
        where: { id: auction.id },
        data: { status: AuctionStatus.UNSOLD, version: { increment: 1 } },
        select: commandAuctionSelect,
      });
      const product = await tx.product.update({
        where: { id: auction.productId },
        data: { status: ProductStatus.DRAFT, publishedAt: null },
        select: { id: true, updatedAt: true },
      });
      await this.outbox.create(tx, {
        eventType: 'AUCTION_WINNER_WINDOW_EXPIRED',
        aggregateType: 'Auction',
        aggregateId: auction.id,
        correlationId,
        payload: {
          auctionId: auction.id,
          previousWinnerIdInvalidated: true,
          status: expired.status,
          version: expired.version,
        },
      });
      await this.productEvents.emit(
        tx,
        PRODUCT_UNPUBLISHED,
        product.id,
        correlationId,
        product.updatedAt,
      );
      return { auction: expired, changed: true };
    });

    return result.auction;
  }

  private async lockAuction(
    tx: Prisma.TransactionClient,
    auctionId: string,
  ): Promise<LockedAuction> {
    const rows = await tx.$queryRaw<LockedAuction[]>(Prisma.sql`
      SELECT auction.id,
             auction."productId",
             auction.status,
             auction."startingPrice",
             auction."minimumIncrement",
             auction."startsAt",
             auction."endsAt",
             auction."currentHighestBidId",
             auction."winnerCheckoutExpiresAt",
             product.status AS "productStatus",
             product.type AS "productType",
             product.stock AS "productStock",
             NOW() AS "dbNow"
      FROM "Auction" AS auction
      JOIN "Product" AS product ON product.id = auction."productId"
      WHERE auction.id = ${auctionId}::uuid
      FOR UPDATE OF auction
    `);
    if (!rows[0]) throw new NotFoundException('Auction not found');
    return rows[0];
  }

  private assertBiddable(auction: LockedAuction): void {
    if (
      auction.productStatus !== ProductStatus.PUBLISHED ||
      auction.productType !== ProductType.AUCTION ||
      auction.productStock !== 1
    ) {
      throw new ConflictException('Auction Product is not available');
    }
    if (auction.dbNow >= auction.endsAt) {
      throw new ConflictException('Auction deadline has passed');
    }
    if (auction.dbNow < auction.startsAt) {
      throw new ConflictException('Auction is not active yet');
    }
    if (
      auction.status !== AuctionStatus.SCHEDULED &&
      auction.status !== AuctionStatus.ACTIVE
    ) {
      throw new ConflictException(
        `Auction is not active while ${auction.status}`,
      );
    }
  }

  private getCommandAuction(tx: Prisma.TransactionClient, id: string) {
    return tx.auction.findUniqueOrThrow({
      where: { id },
      select: commandAuctionSelect,
    });
  }

  private validateIdempotencyKey(key: string): void {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException('Valid Idempotency-Key header is required');
    }
  }

  private findBid(customerId: string, idempotencyKey: string) {
    return this.prisma.bid.findUnique({
      where: {
        bidderId_idempotencyKey: {
          bidderId: customerId,
          idempotencyKey,
        },
      },
      select: bidSelect,
    });
  }

  private resolveBid(
    bid: Prisma.BidGetPayload<{ select: typeof bidSelect }>,
    auctionId: string,
    amount: Prisma.Decimal,
  ) {
    if (bid.auctionId !== auctionId || !bid.amount.equals(amount)) {
      throw new ConflictException(
        'Idempotency key was used for another bid request',
      );
    }
    return bid;
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
