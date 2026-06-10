import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Application,
  ApprovalWorkflow,
  AvailabilitySlot,
  Document,
  DocumentType,
  DriverProfile,
  OperatingArea,
  User,
  Vehicle,
} from '../database/entities';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { StorageService } from '../storage/storage.service';
import { OcrService } from '../ocr/ocr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      DocumentType,
      DriverProfile,
      Vehicle,
      Document,
      User,
      OperatingArea,
      AvailabilitySlot,
      ApprovalWorkflow,
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, StorageService, OcrService],
  exports: [StorageService, OcrService],
})
export class OnboardingModule {}
