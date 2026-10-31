import {
  Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { DriverProfile } from './driver.entity';

export type MassTenderStatus = 'draft' | 'open' | 'filled' | 'closed' | 'cancelled';
export type MassAcceptanceStatus = 'accepted' | 'withdrawn';

/**
 * An "open call" tender with NO route. The dispatcher asks for N drivers to report
 * to the hub during a pickup window, split into fixed loading slots (e.g. 30 min)
 * with a max number of drivers loading at once. Drivers accept and pick a slot;
 * the actual route is assigned in person at the hub (outside the system).
 */
@Entity('mass_tenders')
export class MassTender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string; // MT-1001

  @Column({ nullable: true })
  name?: string;

  @Column({ type: 'date' })
  operationalDate: string; // YYYY-MM-DD

  @Column({ default: 'PasarEx Hub' })
  hubName: string;

  @Column()
  windowStart: string; // 'HH:MM' overall pickup window start

  @Column()
  windowEnd: string; // 'HH:MM' overall pickup window end

  @Column({ type: 'int' })
  slotMinutes: number; // length of each individual loading slot

  @Column({ type: 'int' })
  maxConcurrent: number; // max drivers loading simultaneously (per slot)

  @Column({ type: 'int' })
  driversNeeded: number; // hard cap on total accepted drivers

  @Column({ type: 'varchar', default: 'draft' })
  status: MassTenderStatus;

  @Column({ nullable: true })
  createdBy?: string;

  @OneToMany(() => MassTenderAcceptance, (a) => a.massTender)
  acceptances: MassTenderAcceptance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/** One driver's acceptance of a mass tender, committed to a specific loading slot. */
@Entity('mass_tender_acceptances')
@Index(['massTenderId', 'driverId'], { unique: true })
export class MassTenderAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MassTender, (t) => t.acceptances, { onDelete: 'CASCADE' })
  massTender: MassTender;

  @Column({ type: 'uuid' })
  massTenderId: string;

  @ManyToOne(() => DriverProfile, { onDelete: 'CASCADE' })
  driver: DriverProfile;

  @Column({ type: 'uuid' })
  driverId: string;

  @Column()
  slotStart: string; // 'HH:MM' the chosen loading slot

  @Column({ type: 'varchar', default: 'accepted' })
  status: MassAcceptanceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
