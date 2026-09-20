import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilitySlot, Document, DocumentType, DriverProfile, OperatingArea, User, Vehicle } from '../database/entities';
import { DriverProfileService } from './driver-profile.service';
import { DriverProfileController } from './driver-profile.controller';
import { DriverAdminController } from './driver-admin.controller';
import { DriverDocumentsService } from './driver-documents.service';
import { DriverDocumentsController } from './driver-documents.controller';
import { StorageService } from '../storage/storage.service';
import { OcrService } from '../ocr/ocr.service';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle, AvailabilitySlot, OperatingArea, User, Document, DocumentType])],
  controllers: [DriverProfileController, DriverAdminController, DriverDocumentsController],
  providers: [DriverProfileService, DriverDocumentsService, StorageService, OcrService],
})
export class DriverModule {}
