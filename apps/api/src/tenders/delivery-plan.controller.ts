import { Body, Controller, ForbiddenException, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Role, JwtPayload } from '@sherpa/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { DeliveryPlanService } from './delivery-plan.service';

class PlanLineDto {
  @IsString() parish: string;
  @IsInt() @Min(1) packages: number;
  @IsOptional() @IsArray() @IsString({ each: true }) preassigned?: string[];
}
class CreatePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() hubName?: string;
  @IsOptional() vehicleCapacities?: Record<string, number>;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PlanLineDto) lines: PlanLineDto[];
}

@Controller()
export class DeliveryPlanController {
  constructor(private readonly plans: DeliveryPlanService) {}

  @Post('delivery-plans')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto as any);
  }

  @Get('delivery-plans')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  list() {
    return this.plans.list();
  }

  @Get('delivery-plans/:id')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  get(@Param('id') id: string) {
    return this.plans.get(id);
  }

  @Post('delivery-plans/:id/broadcast')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  broadcast(@Param('id') id: string) {
    return this.plans.broadcast(id);
  }

  // ── driver side ──
  @Get('driver/plan-tenders')
  @Roles(Role.DRIVER)
  myTenders(@CurrentUser() user: JwtPayload) {
    return this.plans.driverTenders(this.driverId(user));
  }

  @Post('plan-tenders/:id/accept')
  @Roles(Role.DRIVER)
  accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.plans.accept(id, this.driverId(user));
  }

  @Post('plan-tenders/:id/decline')
  @Roles(Role.DRIVER)
  decline(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.plans.decline(id, this.driverId(user));
  }

  private driverId(user: JwtPayload): string {
    if (!user.driverId) throw new ForbiddenException('No driver profile for this account');
    return user.driverId;
  }
}
