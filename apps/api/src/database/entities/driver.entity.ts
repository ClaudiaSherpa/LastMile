import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverStatus, DriverTier, VehicleType } from '@sherpa/shared';
import { User } from './user.entity';

@Entity('operating_areas')
export class OperatingArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nameEs: string;

  @Column()
  nameEn: string;

  @Column({ unique: true })
  slug: string;

  // PostGIS polygon (WGS84). Stored as GeoJSON in/out.
  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326, nullable: true })
  area?: object;

  // representative centroid for quick rendering
  @Column({ type: 'double precision', nullable: true })
  centerLng?: number;

  @Column({ type: 'double precision', nullable: true })
  centerLat?: number;

  @Column({ default: true })
  active: boolean;
}

@Entity('driver_profiles')
export class DriverProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.driverProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ nullable: true })
  cedula?: string;

  // home address (captured from the utility bill at onboarding)
  @Column({ nullable: true })
  address?: string;

  // explicitly-assigned pay rate card (else the default card applies)
  @Column({ type: 'uuid', nullable: true })
  rateCardId?: string;

  @Column({ type: 'enum', enum: DriverStatus, default: DriverStatus.OFFDUTY })
  status: DriverStatus;

  @Column({ default: false })
  onDuty: boolean;

  // security clearance gate — true only after the security stage passes
  @Column({ default: false })
  securityCleared: boolean;

  // becomes false while a required doc has lapsed (auto-suspend)
  @Column({ default: false })
  eligible: boolean;

  @Column({ type: 'double precision', default: 0 })
  score: number;

  @Column({ type: 'enum', enum: DriverTier, default: DriverTier.NUEVO })
  tier: DriverTier;

  // rolling performance counters used by the scoring engine
  @Column({ type: 'int', default: 0 })
  deliveriesCount: number;

  @Column({ type: 'double precision', default: 100 })
  acceptanceRate: number;

  @Column({ type: 'double precision', default: 100 })
  onTimeRate: number;

  @Column({ type: 'double precision', default: 100 })
  completionRate: number;

  @Column({ type: 'double precision', default: 0 })
  avgRating: number;

  // last known position (denormalized for fast map reads)
  @Column({ type: 'double precision', nullable: true })
  lastLng?: number;

  @Column({ type: 'double precision', nullable: true })
  lastLat?: number;

  @OneToMany(() => Vehicle, (v) => v.driver)
  vehicles: Vehicle[];

  @ManyToMany(() => OperatingArea)
  @JoinTable({ name: 'driver_operating_areas' })
  operatingAreas: OperatingArea[];

  @OneToMany(() => AvailabilitySlot, (s) => s.driver)
  availability: AvailabilitySlot[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DriverProfile, (d) => d.vehicles, { onDelete: 'CASCADE' })
  driver: DriverProfile;

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  @Column()
  plate: string;

  @Column({ nullable: true })
  brand?: string;

  @Column({ nullable: true })
  model?: string;

  @Column({ type: 'int', nullable: true })
  year?: number;

  @Column({ nullable: true })
  color?: string;

  @Column({ type: 'double precision', nullable: true })
  capacityKg?: number;

  @Column({ type: 'double precision', nullable: true })
  capacityVolM3?: number;

  @Column({ nullable: true })
  dimensions?: string; // "LxWxH cm"

  @Column({ default: false })
  refrigerated: boolean;

  @Column({ default: true })
  active: boolean;
}

@Entity('availability_slots')
export class AvailabilitySlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DriverProfile, (d) => d.availability, { onDelete: 'CASCADE' })
  driver: DriverProfile;

  // 0=Sun .. 6=Sat (recurring weekly)
  @Column({ type: 'int' })
  weekday: number;

  // time block: madrugada|manana|tarde|noche
  @Column()
  block: string;
}
