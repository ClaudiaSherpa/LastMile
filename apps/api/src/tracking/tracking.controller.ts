import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DeliveryStatus, Role } from '@sherpa/shared';
import { Public, Roles } from '../auth/decorators';
import { TrackingService } from './tracking.service';

class PingDto {
  @IsString() driverId: string;
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

  /** Driver GPS stream. Public (link/device-based driver app); driverId in body. */
  @Public()
  @Post('tracking/ping')
  ping(@Body() dto: PingDto) {
    return this.tracking.ping(dto);
  }

  /** Live driver positions for the Ops map. */
  @Get('tracking/live')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  live() {
    return this.tracking.live();
  }

  /** Advance a delivery's lifecycle. */
  @Public()
  @Post('deliveries/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.tracking.setStatus(id, dto.status);
  }

  /** Consignee tracking link (token-gated, no account). */
  @Public()
  @Get('track/:token')
  byToken(@Param('token') token: string) {
    return this.tracking.byToken(token);
  }
}
