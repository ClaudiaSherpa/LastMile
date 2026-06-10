import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification, NotificationTemplate, User } from '../database/entities';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationTemplate, User])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
