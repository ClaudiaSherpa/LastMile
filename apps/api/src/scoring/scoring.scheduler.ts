import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ScoringService } from './scoring.service';
import { env } from '../config/env';

/** Nightly DriverScore recompute via BullMQ (03:00). Degrades if Redis is down. */
@Injectable()
export class ScoringScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ScoringScheduler');
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly scoring: ScoringService) {}

  async onModuleInit() {
    const connection = { host: env.redis.host, port: env.redis.port, maxRetriesPerRequest: null };
    try {
      this.queue = new Queue('scoring', { connection });
      this.worker = new Worker(
        'scoring',
        async (job) => {
          if (job.name === 'nightly') return this.scoring.recomputeAll();
        },
        { connection },
      );
      await this.queue.add('nightly', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'scoring-nightly', removeOnComplete: true, removeOnFail: 50 });
      this.logger.log('nightly score recompute scheduled (03:00)');
    } catch (e: any) {
      this.logger.warn(`Redis/BullMQ unavailable — nightly scoring disabled: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => {});
    await this.queue?.close().catch(() => {});
  }
}
