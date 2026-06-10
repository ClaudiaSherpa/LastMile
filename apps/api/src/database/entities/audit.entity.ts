import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * AuditLog — append-only record of approvals, eligibility changes and document
 * status changes. Actor, timestamp and reason are always captured.
 */
@Entity('audit_logs')
@Index(['entity', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  actorUserId?: string;

  @Column({ nullable: true })
  actorName?: string;

  @Column()
  action: string; // e.g. 'application.approved', 'eligibility.suspended'

  @Column()
  entity: string; // e.g. 'Application'

  @Column({ nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  before?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  after?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt: Date;
}
