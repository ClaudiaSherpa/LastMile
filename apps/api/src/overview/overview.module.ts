import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Application,
  ApprovalStage,
  DocumentType,
  DriverProfile,
  Freight,
  OperatingArea,
} from '../database/entities';
import { OverviewController } from './overview.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverProfile,
      Application,
      Freight,
      DocumentType,
      OperatingArea,
      ApprovalStage,
    ]),
  ],
  controllers: [OverviewController],
})
export class OverviewModule {}
