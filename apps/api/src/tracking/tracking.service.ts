import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeliveryStatus,
  DriverStatus,
  FreightStatus,
  JwtPayload,
  Role,
  WS_EVENTS,
} from '@sherpa/shared';
import { Delivery, DriverProfile, Freight, LocationPing } from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuditService } from '../audit/audit.service';
import { RatingsService } from '../ratings/ratings.service';
import { ScoringService } from '../scoring/scoring.service';

export interface PingInput {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  deliveryId?: string;
}

// terminal + ordered delivery lifecycle
const FLOW: DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.EN_ROUTE_PICKUP,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.EN_ROUTE,
  DeliveryStatus.DELIVERED,
];

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(LocationPing) private pings: Repository<LocationPing>,
    @InjectRepository(DriverProfile) private drivers: Repository<DriverProfile>,
    @InjectRepository(Delivery) private deliveries: Repository<Delivery>,
    @InjectRepository(Freight) private freights: Repository<Freight>,
    private realtime: RealtimeGateway,
    private audit: AuditService,
    private ratings: RatingsService,
    private scoring: ScoringService,
  ) {}

  /** Ingest a GPS ping: persist, update denormalized position, fan out over WS. */
  async ping(input: PingInput) {
    await this.pings.save(
      this.pings.create({
        driverId: input.driverId,
        deliveryId: input.deliveryId,
        lat: input.lat,
        lng: input.lng,
        heading: input.heading,
        speed: input.speed,
      }),
    );
    await this.drivers.update(input.driverId, { lastLng: input.lng, lastLat: input.lat });

    const payload = { driverId: input.driverId, lng: input.lng, lat: input.lat, heading: input.heading, speed: input.speed };
    this.realtime.emitOps(WS_EVENTS.DRIVER_LOCATION, payload);
    if (input.deliveryId) this.realtime.emitDelivery(input.deliveryId, WS_EVENTS.DRIVER_LOCATION, payload);
    return { ok: true };
  }

  /** Drivers currently in motion for the Ops live map. */
  async live() {
    const list = await this.drivers.find({ relations: { user: true, vehicles: true } });
    return list
      .filter((d) => d.lastLng != null && d.lastLat != null)
      .map((d) => ({
        id: d.id,
        name: d.user?.fullName,
        status: d.status,
        tier: d.tier,
        vehicle: d.vehicles?.[0]?.type,
        lng: d.lastLng,
        lat: d.lastLat,
      }));
  }

  /** Advance a delivery's lifecycle; records the timeline and notifies rooms. */
  async setStatus(deliveryId: string, status: DeliveryStatus, actor: JwtPayload) {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId },
      relations: { driver: true, freight: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    // a driver may only advance a delivery assigned to them; ops (dispatcher/admin) may advance any
    if (actor.role === Role.DRIVER && delivery.driver?.id !== actor.driverId) {
      throw new ForbiddenException('Not your delivery');
    }
    if (!FLOW.includes(status) && status !== DeliveryStatus.FAILED) {
      throw new BadRequestException('Invalid status');
    }

    delivery.status = status;
    delivery.timeline = { ...(delivery.timeline ?? {}), [status]: new Date().toISOString() };
    if (status === DeliveryStatus.DELIVERED || status === DeliveryStatus.FAILED) {
      delivery.completedAt = new Date();
      if (delivery.freight) {
        delivery.freight.status = status === DeliveryStatus.DELIVERED ? FreightStatus.COMPLETED : FreightStatus.CANCELLED;
        await this.freights.save(delivery.freight);
      }
      if (delivery.driver) {
        delivery.driver.status = DriverStatus.IDLE;
        await this.drivers.save(delivery.driver);
      }
    } else if (delivery.driver) {
      delivery.driver.status = status === DeliveryStatus.EN_ROUTE || status === DeliveryStatus.EN_ROUTE_PICKUP
        ? DriverStatus.ENROUTE
        : DriverStatus.DELIVERING;
      await this.drivers.save(delivery.driver);
    }
    await this.deliveries.save(delivery);

    await this.audit.log({
      action: 'delivery.status',
      entity: 'Delivery',
      entityId: delivery.id,
      after: { status },
    });
    const payload = { deliveryId: delivery.id, status, timeline: delivery.timeline };
    this.realtime.emitOps(WS_EVENTS.DELIVERY_UPDATED, payload);
    this.realtime.emitDelivery(delivery.id, WS_EVENTS.DELIVERY_UPDATED, payload);

    // on completion: message the consignee for a rating + recompute the driver score
    if (status === DeliveryStatus.DELIVERED) {
      await this.ratings.requestRating(delivery.id).catch(() => {});
      if (delivery.driver) await this.scoring.recomputeDriver(delivery.driver.id).catch(() => {});
    } else if (status === DeliveryStatus.FAILED && delivery.driver) {
      await this.scoring.recomputeDriver(delivery.driver.id).catch(() => {});
    }
    return payload;
  }

  /** A driver's own deliveries (batch runs + freight), newest first. */
  async driverDeliveries(driverId: string) {
    const rows = await this.deliveries.find({
      where: { driver: { id: driverId } },
      relations: { freight: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((d) => ({
      id: d.id,
      status: d.status,
      parish: d.parish,
      packages: d.packages,
      trackingToken: d.trackingToken,
      reference: d.freight?.reference ?? (d.parish ? `Batch · ${d.parish}` : 'Delivery'),
      pickup: d.freight?.pickupZone ?? 'PasarEx Hub',
      drop: d.freight?.dropZone ?? d.parish,
      createdAt: d.createdAt,
    }));
  }

  /** Public consignee view, gated by the opaque tracking token. */
  async byToken(token: string) {
    const delivery = await this.deliveries.findOne({
      where: { trackingToken: token },
      relations: { driver: { user: true, vehicles: true }, freight: true },
    });
    if (!delivery) throw new NotFoundException('Tracking link not found');
    return {
      id: delivery.id,
      status: delivery.status,
      timeline: delivery.timeline,
      etaMinutes: delivery.etaMinutes,
      freight: delivery.freight
        ? {
            reference: delivery.freight.reference,
            pickupZone: delivery.freight.pickupZone,
            dropZone: delivery.freight.dropZone,
          }
        : { reference: delivery.parish ? `Batch · ${delivery.parish}` : 'Delivery', pickupZone: 'PasarEx Hub', dropZone: delivery.parish ?? '' },
      // never expose driver PII beyond first name + vehicle/plate
      driver: delivery.driver
        ? {
            firstName: delivery.driver.user?.fullName?.split(' ')[0],
            vehicle: delivery.driver.vehicles?.[0]?.type,
            plate: delivery.driver.vehicles?.[0]?.plate,
            tier: delivery.driver.tier,
            lng: delivery.driver.lastLng,
            lat: delivery.driver.lastLat,
          }
        : null,
    };
  }
}
