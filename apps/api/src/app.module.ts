import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OverviewModule } from './overview/overview.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ComplianceModule } from './compliance/compliance.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TenderModule } from './tenders/tender.module';
import { TrackingModule } from './tracking/tracking.module';
import { ScoringModule } from './scoring/scoring.module';
import { RatingsModule } from './ratings/ratings.module';
import { ConfigAdminModule } from './config-admin/config.module';
import { DocumentsModule } from './documents/documents.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { MessagingModule } from './messaging/messaging.module';
import { DriverModule } from './driver/driver.module';
import { JwtAuthGuard, RolesGuard } from './auth/guards';
import { AppController } from './app.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditModule,
    NotificationsModule,
    RealtimeModule,
    OverviewModule,
    OnboardingModule,
    WorkflowModule,
    ComplianceModule,
    TenderModule,
    TrackingModule,
    ScoringModule,
    RatingsModule,
    ConfigAdminModule,
    DocumentsModule,
    WhatsAppModule,
    DriverModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [
    // RBAC enforced globally: every route is authenticated + role-checked unless @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
