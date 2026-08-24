import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  it('exports custom counters and bounded queue duration labels', async () => {
    const metrics = new MetricsService();
    metrics.recordCheckoutSucceeded();
    metrics.recordCheckoutFailed();
    metrics.recordInventoryConflict();
    metrics.recordAuctionBidAccepted();
    metrics.recordAuctionBidRejected();
    metrics.recordQueueProcessed('domain-events', 0.25);
    metrics.recordQueueFailed('domain-events');
    metrics.recordOutboxPublishFailure();

    const output = await metrics.getMetrics();
    expect(output).toContain('marketplace_checkout_succeeded_total 1');
    expect(output).toContain('marketplace_checkout_failed_total 1');
    expect(output).toContain('marketplace_inventory_conflicts_total 1');
    expect(output).toContain(
      'marketplace_queue_job_processing_duration_seconds_count{queue="domain-events"} 1',
    );
  });
});
