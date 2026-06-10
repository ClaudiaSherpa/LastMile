import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OverviewModule } from './overview/overview.module';
import { JwtAuthGuard, RolesGuard } from './auth/guards';
import { AppController } from './app.controller';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule, NotificationsModule, OverviewModule],
  controllers: [AppController],
  providers: [
    // RBAC enforced globally: every route is authenticated + role-checked unless @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
