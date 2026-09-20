import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, DriverProfile, Reminder, User } from '../database/entities';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { ComplianceScheduler } from './compliance.scheduler';
import { DocumentReviewService } from './document-review.service';
import { DocumentReviewController } from './document-review.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DriverProfile, Reminder, User]), WhatsAppModule, RealtimeModule],
  controllers: [ComplianceController, DocumentReviewController],
  providers: [ComplianceService, ComplianceScheduler, DocumentReviewService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
