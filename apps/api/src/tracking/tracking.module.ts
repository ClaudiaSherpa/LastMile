import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery, DriverProfile, Freight, LocationPing } from '../database/entities';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { TrackingSimulator } from './tracking.simulator';
import { RatingsModule } from '../ratings/ratings.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationPing, DriverProfile, Delivery, Freight]),
    RatingsModule,
    ScoringModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingSimulator],
  exports: [TrackingService],
})
export class TrackingModule {}
