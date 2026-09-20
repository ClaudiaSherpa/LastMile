import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Delivery,
  DeliveryPlan,
  DeliveryPlanLine,
  DriverDay,
  DriverProfile,
  PlanTender,
  User,
} from '../database/entities';
import { DeliveryPlanService } from './delivery-plan.service';
import { DeliveryPlanController } from './delivery-plan.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { RateCardModule } from '../rate-cards/rate-card.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryPlan, DeliveryPlanLine, PlanTender, DriverProfile, User, Delivery, DriverDay]),
    WhatsAppModule,
    RateCardModule,
  ],
  controllers: [DeliveryPlanController],
  providers: [DeliveryPlanService],
  exports: [DeliveryPlanService],
})
export class TenderModule {}
