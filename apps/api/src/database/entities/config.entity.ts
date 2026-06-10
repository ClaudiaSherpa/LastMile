import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  DriverTier,
  NotificationChannel,
  ScoringWeights,
  TierThreshold,
} from '@sherpa/shared';
import { DriverProfile } from './driver.entity';
import { Document } from './document.entity';

/**
 * ScoringConfig — CONFIG. Single active row holds the weighted-blend weights and
 * tier thresholds; editable in admin and read by the scoring engine.
 */
@Entity('scoring_configs')
export class ScoringConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'default' })
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'jsonb' })
  weights: ScoringWeights;

  // [{tier, min}] descending; maps score -> tier
  @Column({ type: 'jsonb' })
  tiers: TierThreshold[];

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * NotificationTemplate — CONFIG. All user-facing copy with {{var}} interpolation,
 * per channel + locale. Editable in admin.
 */
@Entity('notification_templates')
@Index(['key', 'channel', 'locale'], { unique: true })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  key: string; // e.g. 'doc.expiring', 'tender.offer', 'rating.request'

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 2 })
  locale: string; // 'es' | 'en'

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: true })
  active: boolean;
}

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE', nullable: true })
  document?: Document;

  @Column()
  templateKey: string;

  @Column({ type: 'timestamptz' })
  scheduledFor: Date;

  @Column({ type: 'int' })
  offsetDays: number;

  @Column({ default: false })
  sent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  recipientUserId?: string;

  @Column({ nullable: true })
  recipientContact?: string; // phone/email for consignee

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column()
  templateKey: string;

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  renderedBody: string;

  @Column({ default: 'sent' })
  status: string; // sent | failed

  @CreateDateColumn()
  createdAt: Date;
}
