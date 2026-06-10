import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DeliveryStatus,
  FreightStatus,
  TenderResponseType,
  VehicleType,
} from '@sherpa/shared';
import { DriverProfile } from './driver.entity';

@Entity('freights')
export class Freight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string; // F-4820

  @Column()
  client: string;

  // consignee contact — hidden from driver, used only for tracking link/rating
  @Column({ nullable: true })
  consigneeName?: string;

  @Column({ nullable: true })
  consigneePhone?: string;

  @Column()
  pickupZone: string;

  @Column()
  dropZone: string;

  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  pickupPoint?: object;

  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  dropPoint?: object;

  @Column({ type: 'enum', enum: VehicleType })
  requiredVehicle: VehicleType;

  @Column({ type: 'double precision', default: 0 })
  weightKg: number;

  @Column({ type: 'int', nullable: true })
  windowMinutes?: number;

  @Column({ type: 'double precision', nullable: true })
  distanceKm?: number;

  @Column({ type: 'int', default: 0 })
  payout: number;

  @Column({ default: false })
  priority: boolean;

  @Column({ type: 'enum', enum: FreightStatus, default: FreightStatus.AVAILABLE })
  status: FreightStatus;

  @ManyToOne(() => DriverProfile, { nullable: true })
  assignedDriver?: DriverProfile;

  @OneToMany(() => Tender, (t) => t.freight)
  tenders: Tender[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('tenders')
export class Tender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Freight, (f) => f.tenders, { onDelete: 'CASCADE' })
  freight: Freight;

  // current broadcast wave (0 = top tier exclusive window)
  @Column({ type: 'int', default: 0 })
  currentWave: number;

  // ranked eligible driver ids computed at broadcast time
  @Column({ type: 'jsonb', default: () => `'[]'` })
  rankedDriverIds: string[];

  @Column({ default: true })
  open: boolean;

  @OneToMany(() => TenderResponse, (r) => r.tender)
  responses: TenderResponse[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('tender_responses')
export class TenderResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tender, (t) => t.responses, { onDelete: 'CASCADE' })
  tender: Tender;

  @ManyToOne(() => DriverProfile)
  driver: DriverProfile;

  @Column({ type: 'int' })
  wave: number;

  @Column({ type: 'enum', enum: TenderResponseType })
  response: TenderResponseType;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Freight)
  freight: Freight;

  @ManyToOne(() => DriverProfile)
  driver: DriverProfile;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.ASSIGNED })
  status: DeliveryStatus;

  // status -> ISO timestamp timeline
  @Column({ type: 'jsonb', default: () => `'{}'` })
  timeline: Record<string, string>;

  // opaque token for the consignee tracking link
  @Column({ unique: true })
  trackingToken: string;

  @Column({ type: 'int', nullable: true })
  etaMinutes?: number;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('location_pings')
@Index(['driverId', 'createdAt'])
export class LocationPing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  driverId: string;

  @Column({ nullable: true })
  deliveryId?: string;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision', nullable: true })
  heading?: number;

  @Column({ type: 'double precision', nullable: true })
  speed?: number;

  @CreateDateColumn()
  createdAt: Date;
}
