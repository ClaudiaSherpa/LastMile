import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery, Rating } from '../database/entities';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Delivery]), ScoringModule],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
