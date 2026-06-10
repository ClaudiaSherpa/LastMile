import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocAppliesTo, DocumentStatus } from '@sherpa/shared';
import { DriverProfile } from './driver.entity';

/**
 * DocumentType — CONFIG. The onboarding form and compliance engine render from
 * these rows; adding one in admin changes the application automatically.
 */
@Entity('document_types')
export class DocumentType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string; // e.g. 'license', 'soat', 'insurance', 'property', 'id'

  @Column()
  nameEs: string;

  @Column()
  nameEn: string;

  @Column({ type: 'enum', enum: DocAppliesTo, default: DocAppliesTo.DRIVER })
  appliesTo: DocAppliesTo;

  @Column({ default: true })
  required: boolean;

  @Column({ default: false })
  tracksExpiry: boolean;

  @Column({ type: 'jsonb', default: () => `'["application/pdf","image/jpeg","image/png"]'` })
  acceptedFileTypes: string[];

  @Column({ type: 'jsonb', nullable: true })
  validationRules?: Record<string, any>;

  // days-before-expiry to fire reminders, e.g. [30,15,3]
  @Column({ type: 'jsonb', default: () => `'[30,15,3]'` })
  reminderOffsets: number[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DocumentType, { eager: true })
  documentType: DocumentType;

  @ManyToOne(() => DriverProfile, { onDelete: 'CASCADE' })
  driver: DriverProfile;

  @Column({ nullable: true })
  fileRef?: string; // storage key

  @Column({ type: 'date', nullable: true })
  issueDate?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: string;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PENDING })
  status: DocumentStatus;

  @Column({ nullable: true })
  rejectionReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
