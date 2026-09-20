import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilitySlot, DriverProfile, OperatingArea, User, Vehicle } from '../database/entities';
import { DriverProfileService } from './driver-profile.service';
import { DriverProfileController } from './driver-profile.controller';
import { DriverAdminController } from './driver-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle, AvailabilitySlot, OperatingArea, User])],
  controllers: [DriverProfileController, DriverAdminController],
  providers: [DriverProfileService],
})
export class DriverModule {}
