import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ReviewsService } from './reviews.service.js';

const customerId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const orderItemId = '33333333-3333-4333-8333-333333333333';
const reviewId = '44444444-4444-4444-8444-444444444444';
const correlationId = '55555555-5555-4555-8555-555555555555';

describe('ReviewsService', () => {
  const tx = {
    $queryRaw: jest.fn(),
    orderItem: { findFirst: jest.fn() },
    review: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    product: { update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const outbox = { create: jest.fn() };
  let service: ReviewsService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: productId }]);
    tx.review.aggregate.mockResolvedValue({
      _avg: { rating: 5 },
      _count: { rating: 1 },
    });
    tx.product.update.mockResolvedValue({ updatedAt: new Date() });
    tx.review.create.mockResolvedValue({
      id: reviewId,
      productId,
      rating: 5,
      text: 'Excellent',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    service = new ReviewsService(prisma as never, outbox as never);
  });

  it('creates a review for the Customer completed purchase', async () => {
    tx.orderItem.findFirst.mockResolvedValue({
      id: orderItemId,
      quantity: 1,
      cancelledQuantity: 0,
    });

    const result = await service.create(
      customerId,
      productId,
      { orderItemId, rating: 5, text: 'Excellent' },
      correlationId,
    );

    expect(result.id).toBe(reviewId);
    const eligibilityQuery: unknown = tx.orderItem.findFirst.mock.calls[0]?.[0];
    expect(eligibilityQuery).toMatchObject({
      where: {
        id: orderItemId,
        productId,
        sellerOrder: { order: { customerId } },
      },
    });
    expect(outbox.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: 'PRODUCT_UPDATED',
        aggregateId: productId,
      }),
    );
  });

  it('rejects a non-purchaser or unfulfilled purchase', async () => {
    tx.orderItem.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        customerId,
        productId,
        { orderItemId, rating: 4, text: 'Good' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(tx.review.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate Product review to a conflict', async () => {
    tx.orderItem.findFirst.mockResolvedValue({
      id: orderItemId,
      quantity: 1,
      cancelledQuantity: 0,
    });
    tx.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(
      service.create(
        customerId,
        productId,
        { orderItemId, rating: 4, text: 'Good' },
        correlationId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents a Customer from editing another Customer review', async () => {
    tx.review.findFirst.mockResolvedValue(null);

    await expect(
      service.update(customerId, reviewId, { rating: 3 }, correlationId),
    ).rejects.toThrow(NotFoundException);
    expect(tx.review.update).not.toHaveBeenCalled();
  });

  it('validates rating bounds and trimmed review text', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      orderItemId,
      rating: 6,
      text: '   ',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['rating', 'text']),
    );
  });
});
