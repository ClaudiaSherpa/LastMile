import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DeliveryStatus, Role } from '@sherpa/shared';
import { JwtPayload } from '@sherpa/shared';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { TrackingService } from './tracking.service';
import { DriverDayService } from './driver-day.service';

const IMG_MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const imgMimeFor = (ref: string) => IMG_MIME[path.extname(ref).toLowerCase()] ?? 'application/octet-stream';

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

class CheckInDto {
  @IsOptional() @IsString() operationalDate?: string;
  @IsOptional() @IsString() depotArrivalAt?: string;
  @IsOptional() @IsInt() @Min(0) packagesPicked?: number;
  @IsOptional() @IsString() depotDepartureAt?: string;
  @IsOptional() @IsNumber() @Min(0) startMileage?: number;
}

class CheckOutDto {
  @IsOptional() @IsString() operationalDate?: string;
  @IsOptional() @IsString() depotReturnAt?: string;
  @IsOptional() @IsNumber() @Min(0) endMileage?: number;
  @IsOptional() @IsInt() @Min(0) successfulDeliveries?: number;
  @IsOptional() @IsInt() @Min(0) packagesReturned?: number;
}

@Controller()
export class TrackingController {
  constructor(
    private readonly tracking: TrackingService,
    private readonly driverDay: DriverDayService,
  ) {}

  private did(user: JwtPayload): string {
    if (!user.driverId) throw new ForbiddenException('No driver profile for this account');
    return user.driverId;
  }

  // ── driver depot day-sheet ──
  @Get('driver/day')
  @Roles(Role.DRIVER)
  getDay(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    return this.driverDay.getDay(this.did(user), date);
  }

  @Post('driver/day/checkin')
  @Roles(Role.DRIVER)
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    return this.driverDay.checkIn(this.did(user), dto);
  }

  @Post('driver/day/checkout')
  @Roles(Role.DRIVER)
  checkOut(@CurrentUser() user: JwtPayload, @Body() dto: CheckOutDto) {
    return this.driverDay.checkOut(this.did(user), dto);
  }

  /** Capture an odometer photo (which=start|end); OCR fills the mileage. */
  @Post('driver/day/odometer')
  @Roles(Role.DRIVER)
  @UseInterceptors(FileInterceptor('file'))
  odometer(@CurrentUser() user: JwtPayload, @UploadedFile() file: any, @Body() body: { which: 'start' | 'end'; operationalDate?: string }) {
    if (!file) throw new BadRequestException('file is required');
    return this.driverDay.setOdometer(this.did(user), body.which, file, body.operationalDate);
  }

  /** The driver views their own odometer photo. */
  @Get('driver/day/odometer/:which/file')
  @Roles(Role.DRIVER)
  async myOdometer(@CurrentUser() user: JwtPayload, @Param('which') which: 'start' | 'end', @Query('date') date: string, @Res() res: Response) {
    const { buffer, fileRef } = await this.driverDay.odometerFile(this.did(user), which, date);
    res.setHeader('Content-Type', imgMimeFor(fileRef));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

  /** Ops views a driver's odometer photo. */
  @Get('drivers/:id/day/odometer/:which/file')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async driverOdometer(@Param('id') id: string, @Param('which') which: 'start' | 'end', @Query('date') date: string, @Res() res: Response) {
    const { buffer, fileRef } = await this.driverDay.odometerFile(id, which, date);
    res.setHeader('Content-Type', imgMimeFor(fileRef));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

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

  /** The authenticated driver's own deliveries (for the driver app). */
  @Get('driver/deliveries')
  @Roles(Role.DRIVER)
  driverDeliveries(@CurrentUser() user: JwtPayload) {
    if (!user.driverId) throw new ForbiddenException('No driver profile for this account');
    return this.tracking.driverDeliveries(user.driverId);
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
