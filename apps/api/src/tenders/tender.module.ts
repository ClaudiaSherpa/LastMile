import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryPlan,
  DeliveryPlanLine,
  DriverProfile,
  PlanTender,
  User,
} from '../database/entities';
import { DeliveryPlanService } from './delivery-plan.service';
import { DeliveryPlanController } from './delivery-plan.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryPlan, DeliveryPlanLine, PlanTender, DriverProfile, User]),
  ],
  controllers: [DeliveryPlanController],
  providers: [DeliveryPlanService],
  exports: [DeliveryPlanService],
})
export class TenderModule {}
