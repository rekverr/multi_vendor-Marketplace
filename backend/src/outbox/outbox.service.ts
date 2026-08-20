import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

export interface CreateOutboxEventInput {
  eventId?: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  schemaVersion?: number;
  occurredAt?: Date;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  create(tx: Prisma.TransactionClient, input: CreateOutboxEventInput) {
    return tx.outboxEvent.create({
      data: {
        ...input,
        schemaVersion: input.schemaVersion ?? 1,
      },
    });
  }

  async processOnce<T>(
    consumerName: string,
    eventId: string,
    handler: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ processed: true; result: T } | { processed: false }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { consumerName, eventId } });
        return handler(tx);
      });
      return { processed: true, result };
    } catch (error) {
      if (this.isDuplicateReceipt(error)) {
        return { processed: false };
      }
      throw error;
    }
  }

  private isDuplicateReceipt(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    return (
      error.meta?.modelName === 'ProcessedEvent' ||
      (Array.isArray(target) &&
        target.includes('consumerName') &&
        target.includes('eventId'))
    );
  }
}
