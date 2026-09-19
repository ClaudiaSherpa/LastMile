import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilitySlot, DriverProfile, OperatingArea, Vehicle } from '../database/entities';
import { DriverProfileService } from './driver-profile.service';
import { DriverProfileController } from './driver-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle, AvailabilitySlot, OperatingArea])],
  controllers: [DriverProfileController],
  providers: [DriverProfileService],
})
export class DriverModule {}
