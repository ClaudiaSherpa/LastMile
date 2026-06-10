import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ApplicationStatus,
  Role,
  SecurityCheckResult,
  StageMode,
  TaskStatus,
  VehicleType,
} from '@sherpa/shared';
import { DriverProfile } from './driver.entity';

/**
 * ApprovalWorkflow / ApprovalStage — CONFIG. Admins build & reorder stages; the
 * pipeline is never hardcoded. One stage is the mandatory security clearance gate.
 */
@Entity('approval_workflows')
export class ApprovalWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => ApprovalStage, (s) => s.workflow, { cascade: true })
  stages: ApprovalStage[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('approval_stages')
export class ApprovalStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ApprovalWorkflow, (w) => w.stages, { onDelete: 'CASCADE' })
  workflow: ApprovalWorkflow;

  @Column()
  nameEs: string;

  @Column()
  nameEn: string;

  @Column({ type: 'int' })
  sortOrder: number;

  @Column({ type: 'enum', enum: StageMode, default: StageMode.MANUAL })
  mode: StageMode;

  @Column({ type: 'enum', enum: Role, default: Role.DISPATCHER })
  responsibleRole: Role;

  // gates tender/volume eligibility until passed
  @Column({ default: false })
  isSecurityClearance: boolean;

  // document type keys required to enter this stage
  @Column({ type: 'jsonb', default: () => `'[]'` })
  requiredDocs: string[];

  // rules for automatic stages (evaluated against submitted data)
  @Column({ type: 'jsonb', nullable: true })
  ruleset?: Record<string, any>;

  @Column({ type: 'int', default: 24 })
  slaHours: number;
}

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string; // e.g. AP-7743

  @ManyToOne(() => DriverProfile, { onDelete: 'CASCADE', nullable: true })
  driver?: DriverProfile;

  @ManyToOne(() => ApprovalWorkflow, { nullable: true })
  workflow?: ApprovalWorkflow;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.DRAFT })
  status: ApplicationStatus;

  // free-form snapshot of the multi-step wizard (save-and-resume)
  @Column({ type: 'jsonb', default: () => `'{}'` })
  draft: Record<string, any>;

  @Column({ nullable: true })
  applicantName?: string;

  @Column({ type: 'enum', enum: VehicleType, nullable: true })
  vehicleType?: VehicleType;

  @Column({ nullable: true })
  plate?: string;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  zones: string[];

  // security sub-checks surfaced in the Ops review screen
  @Column({ type: 'jsonb', default: () => `'{}'` })
  securityChecks: Record<string, SecurityCheckResult>;

  @Column({ type: 'double precision', nullable: true })
  score?: number;

  @ManyToOne(() => ApprovalStage, { nullable: true })
  currentStage?: ApprovalStage;

  @OneToMany(() => ApprovalTask, (t) => t.application, { cascade: true })
  tasks: ApprovalTask[];

  @CreateDateColumn()
  submittedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('approval_tasks')
export class ApprovalTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Application, (a) => a.tasks, { onDelete: 'CASCADE' })
  application: Application;

  @ManyToOne(() => ApprovalStage)
  stage: ApprovalStage;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ nullable: true })
  decidedByUserId?: string;

  @Column({ nullable: true })
  decidedByName?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
