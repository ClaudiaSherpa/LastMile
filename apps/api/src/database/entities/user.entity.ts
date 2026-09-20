import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '@sherpa/shared';
import { DriverProfile } from './driver.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  email?: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  phone?: string;

  @Column()
  fullName: string;

  @Column({ type: 'enum', enum: Role, default: Role.DRIVER })
  role: Role;

  @Column({ nullable: true })
  passwordHash?: string;

  // hashed current refresh token (rotated on refresh)
  @Column({ nullable: true })
  refreshTokenHash?: string;

  // one-time token for a staff invite (set until the invitee completes signup)
  @Index({ unique: true })
  @Column({ nullable: true })
  inviteToken?: string;

  @Column({ default: true })
  active: boolean;

  @OneToOne(() => DriverProfile, (d) => d.user)
  driverProfile?: DriverProfile;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
