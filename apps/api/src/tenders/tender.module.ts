import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Delivery,
  DeliveryPlan,
  DeliveryPlanLine,
  DriverDay,
  DriverProfile,
  MassTender,
  MassTenderAcceptance,
  PlanTender,
  User,
} from '../database/entities';
import { DeliveryPlanService } from './delivery-plan.service';
import { DeliveryPlanController } from './delivery-plan.controller';
import { MassTenderService } from './mass-tender.service';
import { MassTenderController } from './mass-tender.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { RateCardModule } from '../rate-cards/rate-card.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryPlan, DeliveryPlanLine, PlanTender, DriverProfile, User, Delivery, DriverDay, MassTender, MassTenderAcceptance]),
    WhatsAppModule,
    RateCardModule,
  ],
  controllers: [DeliveryPlanController, MassTenderController],
  providers: [DeliveryPlanService, MassTenderService],
  exports: [DeliveryPlanService],
})
export class TenderModule {}
