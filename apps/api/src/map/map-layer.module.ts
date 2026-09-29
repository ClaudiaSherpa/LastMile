import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapLayer } from '../database/entities';
import { MapLayerService } from './map-layer.service';
import { MapLayerController } from './map-layer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MapLayer])],
  controllers: [MapLayerController],
  providers: [MapLayerService],
})
export class MapLayerModule {}
