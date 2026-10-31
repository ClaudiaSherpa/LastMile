import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { JwtPayload, Role } from '@sherpa/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MassTenderInput, MassTenderService } from './mass-tender.service';

@Controller()
export class MassTenderController {
  constructor(private readonly svc: MassTenderService) {}

  // ── ops (admin + dispatcher) ──
  @Post('mass-tenders')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  create(@Body() body: MassTenderInput, @CurrentUser() user: JwtPayload) {
    return this.svc.create(body, user?.email || user?.sub);
  }

  @Get('mass-tenders')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  list() {
    return this.svc.list();
  }

  @Get('mass-tenders/:id')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post('mass-tenders/:id/open')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  open(@Param('id') id: string) {
    return this.svc.open(id);
  }

  @Post('mass-tenders/:id/close')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  close(@Param('id') id: string) {
    return this.svc.close(id);
  }

  @Post('mass-tenders/:id/cancel')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  cancel(@Param('id') id: string) {
    return this.svc.cancel(id);
  }

  @Delete('mass-tenders/:id')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // ── driver ──
  @Get('driver/mass-tenders')
  @Roles(Role.DRIVER)
  mine(@CurrentUser() user: JwtPayload) {
    if (!user?.driverId) throw new BadRequestException('No driver profile on token');
    return this.svc.driverTenders(user.driverId);
  }

  @Post('mass-tenders/:id/accept')
  @Roles(Role.DRIVER)
  accept(@Param('id') id: string, @Body() body: { slotStart: string }, @CurrentUser() user: JwtPayload) {
    if (!user?.driverId) throw new BadRequestException('No driver profile on token');
    if (!body?.slotStart) throw new BadRequestException('A loading window is required');
    return this.svc.accept(id, user.driverId, body.slotStart);
  }

  @Post('mass-tenders/:id/withdraw')
  @Roles(Role.DRIVER)
  withdraw(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user?.driverId) throw new BadRequestException('No driver profile on token');
    return this.svc.withdraw(id, user.driverId);
  }
}
