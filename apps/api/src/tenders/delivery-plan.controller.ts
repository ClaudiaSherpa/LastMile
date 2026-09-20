import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
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
  @IsOptional() @IsString() operationalDate?: string;
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

  /** Eligible drivers for the pre-assign picker. */
  @Get('delivery-plans/eligible-drivers')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  eligibleDrivers() {
    return this.plans.eligibleDrivers();
  }

  /** The day's plan for the live map: drivers, parish, packages and status. */
  @Get('delivery-plans/day')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  dayPlan(@Query('date') date?: string) {
    return this.plans.dayPlan(date);
  }

  /** All delivery plans assigned to a driver (Ops driver panel). */
  @Get('drivers/:id/plans')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  driverPlans(@Param('id') id: string) {
    return this.plans.driverPlanHistory(id);
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

  @Post('delivery-plans/:id/rebroadcast')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  rebroadcast(@Param('id') id: string) {
    return this.plans.rebroadcast(id);
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
