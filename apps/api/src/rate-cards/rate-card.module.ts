import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateCard } from '../database/entities';
import { RateCardService } from './rate-card.service';
import { RateCardController } from './rate-card.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RateCard])],
  controllers: [RateCardController],
  providers: [RateCardService],
  exports: [RateCardService],
})
export class RateCardModule {}
