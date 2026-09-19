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
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryPlan, DeliveryPlanLine, PlanTender, DriverProfile, User]),
    WhatsAppModule,
  ],
  controllers: [DeliveryPlanController],
  providers: [DeliveryPlanService],
  exports: [DeliveryPlanService],
})
export class TenderModule {}
