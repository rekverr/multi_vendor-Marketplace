import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly queueProcessedTotal: Counter<'queue'>;
  private readonly queueFailedTotal: Counter<'queue'>;
  private readonly outboxPublishFailedTotal: Counter;
  private readonly outboxBacklog: Gauge;
  private readonly auctionBidsAcceptedTotal: Counter;
  private readonly auctionBidsRejectedTotal: Counter;
  private readonly checkoutSucceededTotal: Counter;
  private readonly checkoutFailedTotal: Counter;
  private readonly inventoryConflictsTotal: Counter;
  private readonly queueProcessingDuration: Histogram<'queue'>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
      prefix: 'marketplace_',
    });

    this.queueProcessedTotal = new Counter({
      name: 'marketplace_queue_jobs_processed_total',
      help: 'Number of successfully processed queue jobs',
      labelNames: ['queue'],
      registers: [this.registry],
    });
    this.queueFailedTotal = new Counter({
      name: 'marketplace_queue_jobs_failed_total',
      help: 'Number of queue jobs that exhausted an attempt',
      labelNames: ['queue'],
      registers: [this.registry],
    });
    this.outboxPublishFailedTotal = new Counter({
      name: 'marketplace_outbox_publish_failed_total',
      help: 'Number of failed Outbox publication attempts',
      registers: [this.registry],
    });
    this.outboxBacklog = new Gauge({
      name: 'marketplace_outbox_unpublished_events',
      help: 'Current number of unpublished Outbox events',
      registers: [this.registry],
    });
    this.auctionBidsAcceptedTotal = new Counter({
      name: 'marketplace_auction_bids_accepted_total',
      help: 'Number of accepted Auction bids',
      registers: [this.registry],
    });
    this.auctionBidsRejectedTotal = new Counter({
      name: 'marketplace_auction_bids_rejected_total',
      help: 'Number of rejected Auction bids',
      registers: [this.registry],
    });
    this.checkoutSucceededTotal = new Counter({
      name: 'marketplace_checkout_succeeded_total',
      help: 'Number of committed checkout transactions',
      registers: [this.registry],
    });
    this.checkoutFailedTotal = new Counter({
      name: 'marketplace_checkout_failed_total',
      help: 'Number of terminal checkout failures',
      registers: [this.registry],
    });
    this.inventoryConflictsTotal = new Counter({
      name: 'marketplace_inventory_conflicts_total',
      help: 'Number of checkout requests rejected by inventory concurrency or stock validation',
      registers: [this.registry],
    });
    this.queueProcessingDuration = new Histogram({
      name: 'marketplace_queue_job_processing_duration_seconds',
      help: 'Queue job processing duration in seconds',
      labelNames: ['queue'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 15, 30],
      registers: [this.registry],
    });
  }

  recordQueueProcessed(queue: string, durationSeconds?: number): void {
    this.queueProcessedTotal.inc({ queue });
    if (durationSeconds !== undefined && durationSeconds >= 0) {
      this.queueProcessingDuration.observe({ queue }, durationSeconds);
    }
  }

  recordQueueFailed(queue: string): void {
    this.queueFailedTotal.inc({ queue });
  }

  recordOutboxPublishFailure(): void {
    this.outboxPublishFailedTotal.inc();
  }

  setOutboxBacklog(value: number): void {
    this.outboxBacklog.set(value);
  }

  recordAuctionBidAccepted(): void {
    this.auctionBidsAcceptedTotal.inc();
  }

  recordAuctionBidRejected(): void {
    this.auctionBidsRejectedTotal.inc();
  }

  recordCheckoutSucceeded(): void {
    this.checkoutSucceededTotal.inc();
  }

  recordCheckoutFailed(): void {
    this.checkoutFailedTotal.inc();
  }

  recordInventoryConflict(): void {
    this.inventoryConflictsTotal.inc();
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
