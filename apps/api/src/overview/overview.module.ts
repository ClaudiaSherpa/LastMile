import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Application,
  ApprovalStage,
  Delivery,
  Document,
  DocumentType,
  DriverDay,
  DriverProfile,
  Freight,
  OperatingArea,
} from '../database/entities';
import { OverviewController } from './overview.controller';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverProfile,
      Application,
      Freight,
      DocumentType,
      OperatingArea,
      ApprovalStage,
      Delivery,
      Document,
      DriverDay,
    ]),
    MessagingModule,
  ],
  controllers: [OverviewController],
})
export class OverviewModule {}
