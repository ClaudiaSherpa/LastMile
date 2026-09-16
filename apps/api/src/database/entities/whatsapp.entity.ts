import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** A single WhatsApp message, inbound (received) or outbound (sent) via Evolution. */
@Entity('whatsapp_messages')
export class WhatsAppMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column() // 'in' | 'out'
  direction: string;

  @Index()
  @Column() // normalized contact number (digits only)
  contact: string;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ default: 'received' }) // received | sent | failed | skipped
  status: string;

  @Column({ nullable: true })
  providerMessageId?: string;

  @Column({ type: 'uuid', nullable: true })
  driverId?: string;

  @Column({ type: 'jsonb', nullable: true })
  raw?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
