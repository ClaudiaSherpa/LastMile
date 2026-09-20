import { MigrationInterface, QueryRunner } from 'typeorm';

/** Planned hub-arrival time for a driver's day-sheet (planned vs actual pickup). */
export class PlannedArrival1781210000000 implements MigrationInterface {
  name = 'PlannedArrival1781210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_days" ADD COLUMN IF NOT EXISTS "plannedArrivalAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_days" DROP COLUMN IF EXISTS "plannedArrivalAt"`);
  }
}
