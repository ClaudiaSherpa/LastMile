import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Driver pay rate card. Multiple can be active; only one applies to a given
 * driver (their assigned card, else the default). Also holds the configurable
 * assumptions (avg weight per package, avg distance) used to estimate tender pay.
 */
@Entity('rate_cards')
export class RateCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // ISO-ish currency code shown with all monetary values (e.g. BBD, USD)
  @Column({ default: 'BBD' })
  currency: string;

  @Column({ default: true })
  active: boolean;

  // applies to drivers with no explicitly-assigned card
  @Column({ default: false })
  isDefault: boolean;

  @Column({ type: 'date', nullable: true })
  validFrom?: string;

  @Column({ type: 'date', nullable: true })
  validTo?: string;

  // fixed day rate paid in full when the driver meets minPackages, else halved
  @Column({ type: 'int', default: 0 })
  minPackages: number;

  @Column({ type: 'double precision', default: 0 })
  fixedRate: number;

  @Column({ type: 'double precision', default: 0 })
  ratePerPackage: number;

  @Column({ type: 'double precision', default: 0 })
  ratePerKg: number;

  @Column({ type: 'double precision', default: 0 })
  ratePerKm: number;

  // estimate assumptions (admin-only)
  @Column({ type: 'double precision', default: 0 })
  avgWeightKg: number; // average weight per package

  @Column({ type: 'double precision', default: 0 })
  avgDistanceKm: number; // average distance per tender/route

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
