import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Delivery,
  DeliveryPlan,
  DeliveryPlanLine,
  DriverProfile,
  Freight,
  OperatingArea,
  PlanTender,
  Tender,
  TenderResponse,
  User,
} from '../database/entities';
import { FreightService } from './freight.service';
import { TenderService } from './tender.service';
import { FreightController } from './freight.controller';
import { DeliveryPlanService } from './delivery-plan.service';
import { DeliveryPlanController } from './delivery-plan.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Freight,
      Tender,
      TenderResponse,
      Delivery,
      DriverProfile,
      OperatingArea,
      DeliveryPlan,
      DeliveryPlanLine,
      PlanTender,
      User,
    ]),
  ],
  controllers: [FreightController, DeliveryPlanController],
  providers: [FreightService, TenderService, DeliveryPlanService],
  exports: [TenderService, DeliveryPlanService],
})
export class TenderModule {}
