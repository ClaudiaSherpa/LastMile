import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import { ComplianceService } from './compliance.service';
import { ComplianceScheduler } from './compliance.scheduler';

class RenewDto {
  @IsDateString()
  expiryDate: string;
}

@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly scheduler: ComplianceScheduler,
  ) {}

  /** Compliance dashboard — docs expiring soon or expired. */
  @Get()
  @Roles(Role.ADMIN, Role.DISPATCHER)
  overview(@Query('within') within?: string) {
    return this.compliance.overview(new Date(), within ? parseInt(within, 10) : 30);
  }

  /** Run the scan now (synchronous) — returns a summary for immediate feedback. */
  @Post('scan')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  scan() {
    return this.compliance.runDailyScan(new Date());
  }

  /** Enqueue a scan as a BullMQ job (exercises the queue path). */
  @Post('scan/enqueue')
  @Roles(Role.ADMIN)
  async enqueue() {
    const queued = await this.scheduler.enqueueScan();
    return { queued };
  }

  /** Renew a document → re-approve, extend expiry, restore eligibility if valid. */
  @Post('documents/:id/renew')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  renew(@Param('id') id: string, @Body() dto: RenewDto) {
    return this.compliance.renew(id, dto.expiryDate);
  }
}
