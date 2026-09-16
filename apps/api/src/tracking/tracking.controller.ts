import { Body, Controller, ForbiddenException, Get, Param, Post } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DeliveryStatus, Role } from '@sherpa/shared';
import { JwtPayload } from '@sherpa/shared';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { TrackingService } from './tracking.service';

class PingDto {
  @IsNumber() lat: number;
  @IsNumber() lng: number;
  @IsOptional() @IsNumber() heading?: number;
  @IsOptional() @IsNumber() speed?: number;
  @IsOptional() @IsString() deliveryId?: string;
}

class StatusDto {
  @IsEnum(DeliveryStatus) status: DeliveryStatus;
}

@Controller()
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  /** Driver GPS stream. Authenticated driver only; identity comes from the JWT, not the body. */
  @Post('tracking/ping')
  @Roles(Role.DRIVER)
  ping(@CurrentUser() user: JwtPayload, @Body() dto: PingDto) {
    if (!user.driverId) throw new ForbiddenException('No driver profile for this account');
    return this.tracking.ping({ ...dto, driverId: user.driverId });
  }

  /** Live driver positions for the Ops map. */
  @Get('tracking/live')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  live() {
    return this.tracking.live();
  }

  /**
   * Advance a delivery's lifecycle. A driver may only advance their own delivery;
   * dispatchers/admins may advance any (e.g. to mark a failure).
   */
  @Post('deliveries/:id/status')
  @Roles(Role.DRIVER, Role.DISPATCHER, Role.ADMIN)
  setStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: StatusDto) {
    return this.tracking.setStatus(id, dto.status, user);
  }

  /** Consignee tracking link (token-gated, no account). */
  @Public()
  @Get('track/:token')
  byToken(@Param('token') token: string) {
    return this.tracking.byToken(token);
  }
}
