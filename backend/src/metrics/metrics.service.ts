import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly queueProcessedTotal: Counter<'queue'>;
  private readonly queueFailedTotal: Counter<'queue'>;
  private readonly outboxPublishFailedTotal: Counter;
  private readonly outboxBacklog: Gauge;
  private readonly auctionBidsAcceptedTotal: Counter;
  private readonly auctionBidsRejectedTotal: Counter;

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
  }

  recordQueueProcessed(queue: string): void {
    this.queueProcessedTotal.inc({ queue });
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

  get contentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
