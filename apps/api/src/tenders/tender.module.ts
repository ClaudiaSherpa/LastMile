import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Delivery,
  DriverProfile,
  Freight,
  OperatingArea,
  Tender,
  TenderResponse,
} from '../database/entities';
import { FreightService } from './freight.service';
import { TenderService } from './tender.service';
import { FreightController } from './freight.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Freight,
      Tender,
      TenderResponse,
      Delivery,
      DriverProfile,
      OperatingArea,
    ]),
  ],
  controllers: [FreightController],
  providers: [FreightService, TenderService],
  exports: [TenderService],
})
export class TenderModule {}
