import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Role, JwtPayload } from '@sherpa/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { DriverProfileService } from './driver-profile.service';

class VehicleDto {
  @IsOptional() @IsString() type?: any;
  @IsOptional() @IsString() plate?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() year?: number | string;
}
class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @ValidateNested() @Type(() => VehicleDto) vehicle?: VehicleDto;
  @IsOptional() @IsArray() @IsString({ each: true }) zones?: string[];
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) days?: number[];
  @IsOptional() @IsArray() @IsString({ each: true }) blocks?: string[];
}

@Controller()
export class DriverProfileController {
  constructor(private readonly svc: DriverProfileService) {}

  private did(user: JwtPayload): string {
    if (!user.driverId) throw new ForbiddenException('No driver profile for this account');
    return user.driverId;
  }

  @Get('driver/profile')
  @Roles(Role.DRIVER)
  get(@CurrentUser() user: JwtPayload) {
    return this.svc.get(this.did(user));
  }

  @Patch('driver/profile')
  @Roles(Role.DRIVER)
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.svc.update(this.did(user), dto as any);
  }
}
