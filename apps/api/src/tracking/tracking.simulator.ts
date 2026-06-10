import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DeliveryStatus, DriverStatus, WS_EVENTS } from '@sherpa/shared';
import { Delivery, DriverProfile } from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TrackingService } from './tracking.service';
import { env } from '../config/env';

interface SimState {
  lng: number;
  lat: number;
  targetLng: number;
  targetLat: number;
  status: string;
  deliveryId?: string;
}

const ACTIVE = [DeliveryStatus.ASSIGNED, DeliveryStatus.EN_ROUTE_PICKUP, DeliveryStatus.PICKED_UP, DeliveryStatus.EN_ROUTE];

/**
 * Server-side GPS simulation. Active-delivery drivers head toward their dropoff;
 * idle drivers jitter in place. Emits driver.location so the live map moves with
 * no real device. Disable with TRACKING_SIMULATE=off.
 */
@Injectable()
export class TrackingSimulator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TrackingSim');
  private timer?: NodeJS.Timeout;
  private tick = 0;
  private state = new Map<string, SimState>();

  constructor(
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Delivery) private deliveries: Repository<Delivery>,
    private realtime: RealtimeGateway,
    private tracking: TrackingService,
  ) {}

  async onModuleInit() {
    if (!env.tracking.simulate) {
      this.logger.log('GPS simulation disabled');
      return;
    }
    await this.refresh();
    this.timer = setInterval(() => this.step().catch(() => {}), env.tracking.simIntervalMs);
    this.logger.log(`GPS simulation on (${env.tracking.simIntervalMs}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Seed positions/targets from the DB (drivers + their active deliveries). */
  private async refresh() {
    const drivers = await this.drivers.find();
    const active = await this.deliveries.find({
      where: { status: In(ACTIVE) },
      relations: { driver: true, freight: true },
    });
    const dropByDriver = new Map<string, { lng: number; lat: number; deliveryId: string }>();
    for (const d of active) {
      const p: any = d.freight?.dropPoint;
      if (d.driver && p?.coordinates) {
        dropByDriver.set(d.driver.id, { lng: p.coordinates[0], lat: p.coordinates[1], deliveryId: d.id });
      }
    }
    for (const dr of drivers) {
      if (dr.lastLng == null || dr.lastLat == null) continue;
      const drop = dropByDriver.get(dr.id);
      this.state.set(dr.id, {
        lng: dr.lastLng,
        lat: dr.lastLat,
        targetLng: drop?.lng ?? dr.lastLng,
        targetLat: drop?.lat ?? dr.lastLat,
        status: dr.status,
        deliveryId: drop?.deliveryId,
      });
    }
  }

  private async step() {
    this.tick++;
    if (this.tick % 24 === 0) await this.refresh(); // resync targets periodically

    for (const [driverId, s] of this.state) {
      const moving = s.deliveryId || s.status === DriverStatus.ENROUTE || s.status === DriverStatus.DELIVERING;
      if (moving && (Math.abs(s.targetLng - s.lng) > 0.0005 || Math.abs(s.targetLat - s.lat) > 0.0005)) {
        // step ~12% toward target + small noise
        s.lng += (s.targetLng - s.lng) * 0.12 + (Math.random() - 0.5) * 0.0008;
        s.lat += (s.targetLat - s.lat) * 0.12 + (Math.random() - 0.5) * 0.0008;
      } else {
        // gentle idle jitter
        s.lng += (Math.random() - 0.5) * 0.0010;
        s.lat += (Math.random() - 0.5) * 0.0010;
      }

      if (s.deliveryId) {
        // persist + fan out to ops + delivery room
        await this.tracking.ping({ driverId, lng: s.lng, lat: s.lat, deliveryId: s.deliveryId });
      } else {
        this.realtime.emitOps(WS_EVENTS.DRIVER_LOCATION, { driverId, lng: s.lng, lat: s.lat });
      }
    }
  }
}
