import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverGroup, DriverProfile } from '../database/entities';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { DriverGroupService } from './driver-group.service';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverGroup, DriverProfile]), WhatsAppModule],
  controllers: [MessagingController],
  providers: [DriverGroupService, MessagingService],
  exports: [DriverGroupService],
})
export class MessagingModule {}
