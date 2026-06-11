import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery, DriverProfile, Rating, ScoringConfig } from '../database/entities';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { ScoringScheduler } from './scoring.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, Rating, Delivery, ScoringConfig])],
  controllers: [ScoringController],
  providers: [ScoringService, ScoringScheduler],
  exports: [ScoringService],
})
export class ScoringModule {}
