import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Processor, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { safeErrorMessage, structuredLog } from '../common/structured-log.js';
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

    worker.on('completed', (job) => {
      const durationSeconds =
        job.processedOn && job.finishedOn
          ? Math.max(0, job.finishedOn - job.processedOn) / 1000
          : undefined;
      this.metrics.recordQueueProcessed(queueName, durationSeconds);
    });
    worker.on('failed', (job, error) => {
      this.metrics.recordQueueFailed(queueName);
      this.logger.error(
        structuredLog('QUEUE_JOB_FAILED', {
          queue: queueName,
          jobId: job?.id,
          attempt: job?.attemptsMade,
          correlationId: this.correlationId(job?.data),
          error: safeErrorMessage(error),
        }),
      );
    });
    worker.on('error', (error) => {
      this.logger.error(
        structuredLog('QUEUE_WORKER_ERROR', {
          queue: queueName,
          error: safeErrorMessage(error),
        }),
      );
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

  private correlationId(data: unknown): string | undefined {
    if (
      typeof data === 'object' &&
      data !== null &&
      'correlationId' in data &&
      typeof data.correlationId === 'string'
    ) {
      return data.correlationId;
    }
    return undefined;
  }
}
