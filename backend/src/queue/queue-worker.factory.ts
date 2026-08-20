import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Processor, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { MetricsService } from '../metrics/metrics.service.js';
import { RedisConnectionService } from './redis-connection.service.js';

@Injectable()
export class QueueWorkerFactory implements OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerFactory.name);
  private readonly workers = new Set<Worker>();
  private readonly clients = new Map<Worker, Redis>();

  constructor(
    private readonly connection: RedisConnectionService,
    private readonly metrics: MetricsService,
  ) {}

  create<DataType, ResultType = unknown>(
    queueName: string,
    processor: Processor<DataType, ResultType>,
    concurrency = 5,
  ): Worker<DataType, ResultType> {
    const redis = this.connection.createClient();
    const worker = new Worker<DataType, ResultType>(queueName, processor, {
      connection: redis,
      concurrency,
    });

    worker.on('completed', () => this.metrics.recordQueueProcessed(queueName));
    worker.on('failed', (job, error) => {
      this.metrics.recordQueueFailed(queueName);
      this.logger.error({
        event: 'QUEUE_JOB_FAILED',
        queue: queueName,
        jobId: job?.id,
        attempt: job?.attemptsMade,
        error: error.message,
      });
    });
    worker.on('error', (error) => {
      this.logger.error({
        event: 'QUEUE_WORKER_ERROR',
        queue: queueName,
        error: error.message,
      });
    });

    this.workers.add(worker);
    this.clients.set(worker, redis);
    return worker;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.workers].map((worker) => worker.close()));
    await Promise.all(
      [...this.clients.values()].map((client) => client.quit()),
    );
  }
}
