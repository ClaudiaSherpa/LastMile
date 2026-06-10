import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Delivery } from './freight.entity';
import { DriverProfile } from './driver.entity';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Delivery, { onDelete: 'CASCADE' })
  delivery: Delivery;

  @ManyToOne(() => DriverProfile)
  driver: DriverProfile;

  @Column({ type: 'int' })
  stars: number; // 1..5

  @Column({ type: 'text', nullable: true })
  feedback?: string;

  @CreateDateColumn()
  createdAt: Date;
}
