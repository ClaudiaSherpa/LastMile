import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document, DriverProfile, Reminder, User } from '../database/entities';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { ComplianceScheduler } from './compliance.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DriverProfile, Reminder, User])],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceScheduler],
  exports: [ComplianceService],
})
export class ComplianceModule {}
