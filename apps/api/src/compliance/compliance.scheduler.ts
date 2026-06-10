import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { ComplianceService } from './compliance.service';
import { env } from '../config/env';

/**
 * BullMQ-backed scheduler: a repeatable daily job runs the compliance scan.
 * Degrades gracefully if Redis is unavailable so the API still boots.
 */
@Injectable()
export class ComplianceScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ComplianceScheduler');
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly compliance: ComplianceService) {}

  async onModuleInit() {
    const connection = { host: env.redis.host, port: env.redis.port, maxRetriesPerRequest: null };
    try {
      this.queue = new Queue('compliance', { connection });
      this.worker = new Worker(
        'compliance',
        async (job) => {
          if (job.name === 'daily-scan') return this.compliance.runDailyScan();
        },
        { connection },
      );
      this.worker.on('failed', (job, err) => this.logger.error(`job ${job?.id} failed: ${err.message}`));
      // idempotent repeatable job — every day at 08:00 server time
      await this.queue.add(
        'daily-scan',
        {},
        { repeat: { pattern: '0 8 * * *' }, jobId: 'daily-scan-cron', removeOnComplete: true, removeOnFail: 50 },
      );
      this.logger.log('compliance daily scan scheduled (08:00)');
    } catch (e: any) {
      this.logger.warn(`Redis/BullMQ unavailable — scheduled scans disabled: ${e.message}`);
    }
  }

  /** Enqueue an out-of-band scan (used by the admin trigger as a queued job). */
  async enqueueScan() {
    if (!this.queue) return false;
    await this.queue.add('daily-scan', {}, { removeOnComplete: true });
    return true;
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => {});
    await this.queue?.close().catch(() => {});
  }
}
