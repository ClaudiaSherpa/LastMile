import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryStatus, NotificationChannel } from '@sherpa/shared';
import { Delivery, Rating } from '../database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { ScoringService } from '../scoring/scoring.service';
import { AuditService } from '../audit/audit.service';
import { env } from '../config/env';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger('Ratings');

  constructor(
    @InjectRepository(Rating) private ratings: Repository<Rating>,
    @InjectRepository(Delivery) private deliveries: Repository<Delivery>,
    private notify: NotificationsService,
    private scoring: ScoringService,
    private audit: AuditService,
  ) {}

  /** On delivery completion, message the consignee a rating link (WhatsApp/SMS). */
  async requestRating(deliveryId: string) {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId },
      relations: { driver: { user: true }, freight: true },
    });
    if (!delivery) return;
    // batch (delivery-plan) runs have no single consignee — no rating link to send
    if (!delivery.freight?.consigneePhone) return;
    const link = `${env.api.publicBaseUrl}/?rate=${delivery.trackingToken}`;
    const driverName = delivery.driver?.user?.fullName?.split(' ')[0] ?? 'tu conductor';
    await this.notify.send({
      templateKey: 'rating.request',
      channel: NotificationChannel.WHATSAPP,
      locale: 'es',
      recipientContact: delivery.freight.consigneePhone,
      vars: { driver: driverName, link },
    });
    this.logger.log(`rating request sent for delivery ${delivery.id}`);
    return { link };
  }

  /** Public rating submission via the per-delivery tracking token. */
  async submit(token: string, stars: number, feedback?: string) {
    if (stars < 1 || stars > 5) throw new BadRequestException('stars must be 1..5');
    const delivery = await this.deliveries.findOne({
      where: { trackingToken: token },
      relations: { driver: true },
    });
    if (!delivery) throw new NotFoundException('Invalid rating link');
    if (delivery.status !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException('Delivery not completed yet');
    }
    const existing = await this.ratings.findOne({ where: { delivery: { id: delivery.id } } });
    if (existing) throw new BadRequestException('Already rated');

    await this.ratings.save(
      this.ratings.create({ delivery, driver: delivery.driver, stars, feedback }),
    );
    await this.audit.log({
      action: 'rating.submitted',
      entity: 'Delivery',
      entityId: delivery.id,
      after: { stars },
    });
    const recomputed = delivery.driver ? await this.scoring.recomputeDriver(delivery.driver.id) : null;
    return { ok: true, stars, score: recomputed?.score, tier: recomputed?.tier };
  }

  /** Recent ratings for Ops. */
  async list(driverId?: string) {
    const where = driverId ? { driver: { id: driverId } } : {};
    const list = await this.ratings.find({
      where,
      relations: { driver: { user: true }, delivery: { freight: true } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return list.map((r) => ({
      id: r.id,
      stars: r.stars,
      feedback: r.feedback,
      driver: r.driver?.user?.fullName,
      freight: r.delivery?.freight?.reference,
      at: r.createdAt,
    }));
  }
}
