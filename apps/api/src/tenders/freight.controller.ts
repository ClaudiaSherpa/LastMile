import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@sherpa/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtPayload } from '@sherpa/shared';
import { FreightService } from './freight.service';
import { TenderService } from './tender.service';
import { CreateFreightDto } from './dto';

@Controller()
export class FreightController {
  constructor(
    private readonly freight: FreightService,
    private readonly tender: TenderService,
  ) {}

  @Get('freight')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  list() {
    return this.freight.list();
  }

  /** Premium freight Elite drivers get first access to. Exposes payouts — drivers/ops only. */
  @Get('freight/priority-batch')
  @Roles(Role.DRIVER, Role.DISPATCHER, Role.ADMIN)
  priorityBatch(@Query('tier') tier?: string) {
    return this.freight.priorityBatch(tier);
  }

  @Post('freight')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFreightDto) {
    return this.freight.create(dto, user.email);
  }

  /** Compute the eligible pool, open a tender, broadcast priority wave 0. */
  @Post('freight/:id/broadcast')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  broadcast(@Param('id') id: string) {
    return this.tender.broadcast(id);
  }

  @Get('tenders/:id')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  getTender(@Param('id') id: string) {
    return this.tender.getTender(id);
  }

  /**
   * Driver accept/decline. The driver identity comes from the authenticated JWT
   * (never the request body); the engine still validates pool membership + wave.
   */
  @Post('tenders/:id/accept')
  @Roles(Role.DRIVER)
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tender.accept(id, this.driverId(user));
  }

  @Post('tenders/:id/decline')
  @Roles(Role.DRIVER)
  decline(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tender.decline(id, this.driverId(user));
  }

  /** A driver token must resolve to a DriverProfile (created at onboarding submit). */
  private driverId(user: JwtPayload): string {
    if (!user.driverId) throw new ForbiddenException('No driver profile for this account');
    return user.driverId;
  }
}
