import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DriverStatus, Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import { DriverProfileService } from './driver-profile.service';

class VehicleDto {
  @IsOptional() @IsString() type?: any;
  @IsOptional() @IsString() plate?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() year?: number | string;
}

class AdminUpdateDriverDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() cedula?: string;
  @IsOptional() @ValidateNested() @Type(() => VehicleDto) vehicle?: VehicleDto;
  @IsOptional() @IsArray() @IsString({ each: true }) zones?: string[];
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) days?: number[];
  @IsOptional() @IsArray() @IsString({ each: true }) blocks?: string[];
  @IsOptional() @IsBoolean() securityCleared?: boolean;
  @IsOptional() @IsBoolean() eligible?: boolean;
  @IsOptional() @IsEnum(DriverStatus) status?: DriverStatus;
  @IsOptional() @IsString() rateCardId?: string;
}

/**
 * Ops-side driver record management. Administrators and security officers can
 * view and edit a driver's contact, vehicle, availability, identity and
 * security/eligibility flags. Dispatchers are intentionally excluded.
 */
@Controller()
export class DriverAdminController {
  constructor(private readonly svc: DriverProfileService) {}

  @Get('drivers/:id')
  @Roles(Role.ADMIN, Role.SECURITY_OFFICER)
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Patch('drivers/:id')
  @Roles(Role.ADMIN, Role.SECURITY_OFFICER)
  update(@Param('id') id: string, @Body() dto: AdminUpdateDriverDto) {
    return this.svc.adminUpdate(id, dto as any);
  }
}
