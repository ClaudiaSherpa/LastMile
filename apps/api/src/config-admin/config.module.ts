import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApprovalStage,
  ApprovalWorkflow,
  DocumentType,
  NotificationTemplate,
  OperatingArea,
} from '../database/entities';
import { ConfigController } from './config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentType,
      NotificationTemplate,
      OperatingArea,
      ApprovalWorkflow,
      ApprovalStage,
    ]),
  ],
  controllers: [ConfigController],
})
export class ConfigAdminModule {}
