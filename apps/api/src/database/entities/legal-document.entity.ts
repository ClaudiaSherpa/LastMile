import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type LegalType = 'terms' | 'privacy' | 'requirements';

export interface LegalSection {
  titleEn: string;
  titleEs: string;
  bodyEn: string;
  bodyEs: string;
}

/**
 * Versioned legal content (Terms of Service, Privacy Notice, Requirements),
 * editable by admins. Every publish appends a new version; old versions are kept
 * for audit and only one row per type is `current`.
 */
@Entity('legal_documents')
@Index(['type', 'current'])
@Index(['type', 'version'], { unique: true })
export class LegalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: LegalType;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'jsonb' })
  sections: LegalSection[];

  @Column({ default: false })
  current: boolean;

  @Column({ nullable: true })
  publishedBy?: string;

  @CreateDateColumn()
  publishedAt: Date;
}
