import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverProfile } from './driver.entity';

/**
 * A named group of drivers, used to filter Ops screens and to broadcast
 * messages to a subset of the fleet. A driver may belong to many groups.
 */
@Entity('driver_groups')
export class DriverGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // optional hex colour for the chip, e.g. '#2f80ed'
  @Column({ nullable: true })
  color?: string;

  @ManyToMany(() => DriverProfile)
  @JoinTable({
    name: 'driver_group_members',
    joinColumn: { name: 'driverGroupId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'driverProfileId', referencedColumnName: 'id' },
  })
  drivers: DriverProfile[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
