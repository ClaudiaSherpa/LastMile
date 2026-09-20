import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverProfile } from './driver.entity';

/**
 * A driver's depot day-sheet: check-in (arrival, packages picked, departure,
 * start mileage) and end-of-day (return, end mileage, successful deliveries,
 * bring-backs). One per driver per operational date.
 */
@Entity('driver_days')
@Index(['driverId', 'operationalDate'], { unique: true })
export class DriverDay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DriverProfile, { onDelete: 'CASCADE' })
  driver: DriverProfile;

  @Column({ type: 'uuid' })
  driverId: string;

  @Column({ type: 'date' })
  operationalDate: string;

  // planned hub arrival for pickup (set by the dispatcher when planning)
  @Column({ type: 'timestamptz', nullable: true })
  plannedArrivalAt?: Date;

  // ── start of day (depot check-in) ──
  @Column({ type: 'timestamptz', nullable: true })
  depotArrivalAt?: Date;

  @Column({ type: 'int', nullable: true })
  packagesPicked?: number;

  @Column({ type: 'timestamptz', nullable: true })
  depotDepartureAt?: Date;

  @Column({ type: 'double precision', nullable: true })
  startMileage?: number;

  // ── end of day (depot return) ──
  @Column({ type: 'timestamptz', nullable: true })
  depotReturnAt?: Date;

  @Column({ type: 'double precision', nullable: true })
  endMileage?: number;

  @Column({ type: 'int', nullable: true })
  successfulDeliveries?: number;

  @Column({ type: 'int', nullable: true })
  packagesReturned?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
