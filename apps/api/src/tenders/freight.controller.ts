import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@sherpa/shared';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { JwtPayload } from '@sherpa/shared';
import { FreightService } from './freight.service';
import { TenderService } from './tender.service';
import { CreateFreightDto, RespondDto } from './dto';

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
   * Driver accept/decline. Public + driverId in body because the MVP driver PWA is
   * link/device-based (no JWT yet); the engine validates pool membership + wave.
   */
  @Public()
  @Post('tenders/:id/accept')
  accept(@Param('id') id: string, @Body() dto: RespondDto) {
    return this.tender.accept(id, dto.driverId);
  }

  @Public()
  @Post('tenders/:id/decline')
  decline(@Param('id') id: string, @Body() dto: RespondDto) {
    return this.tender.decline(id, dto.driverId);
  }
}
