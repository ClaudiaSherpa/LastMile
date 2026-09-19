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
  DeliveryPlanStatus,
  PlanLineStatus,
  PlanTenderStatus,
  VehicleType,
} from '@sherpa/shared';
import { DriverProfile } from './driver.entity';

/** An uploaded bulk delivery plan — all freight picked up at a single hub. */
@Entity('delivery_plans')
export class DeliveryPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string; // DP-1001

  @Column({ nullable: true })
  name?: string;

  @Column({ default: 'PasarEx Hub' })
  hubName: string;

  // packages tendered per driver by vehicle type (freight profile, editable per plan)
  @Column({ type: 'jsonb' })
  vehicleCapacities: Partial<Record<VehicleType, number>>;

  @Column({ type: 'enum', enum: DeliveryPlanStatus, default: DeliveryPlanStatus.DRAFT })
  status: DeliveryPlanStatus;

  @OneToMany(() => DeliveryPlanLine, (l) => l.plan)
  lines: DeliveryPlanLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/** One parish's package demand within a plan. */
@Entity('delivery_plan_lines')
export class DeliveryPlanLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DeliveryPlan, (p) => p.lines, { onDelete: 'CASCADE' })
  plan: DeliveryPlan;

  @Index()
  @Column()
  parish: string; // operating-area slug

  @Column({ type: 'int' })
  requiredPackages: number;

  @Column({ type: 'int', default: 0 })
  acceptedPackages: number;

  // driver-profile ids pre-assigned in the plan (auto-accepted on broadcast)
  @Column({ type: 'jsonb', default: () => `'[]'` })
  preassignedDriverIds: string[];

  // eligible-driver count at broadcast (drives scarcest-first ordering)
  @Column({ type: 'int', default: 0 })
  eligibleCount: number;

  @Column({ type: 'int', nullable: true })
  broadcastOrder?: number;

  @Column({ type: 'enum', enum: PlanLineStatus, default: PlanLineStatus.PENDING })
  status: PlanLineStatus;

  @OneToMany(() => PlanTender, (t) => t.line)
  tenders: PlanTender[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/** A per-driver offer for a parish line (sized to the driver's vehicle capacity). */
@Entity('plan_tenders')
export class PlanTender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DeliveryPlanLine, (l) => l.tenders, { onDelete: 'CASCADE' })
  line: DeliveryPlanLine;

  @ManyToOne(() => DriverProfile, { onDelete: 'CASCADE' })
  driver: DriverProfile;

  @Column({ type: 'int' })
  packages: number;

  @Column({ default: false })
  preassigned: boolean;

  @Column({ type: 'enum', enum: PlanTenderStatus, default: PlanTenderStatus.OFFERED })
  status: PlanTenderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt?: Date;
}
