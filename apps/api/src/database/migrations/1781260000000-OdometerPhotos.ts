import { MigrationInterface, QueryRunner } from 'typeorm';

/** Odometer photo storage keys for start/end mileage capture. */
export class OdometerPhotos1781260000000 implements MigrationInterface {
  name = 'OdometerPhotos1781260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_days" ADD COLUMN IF NOT EXISTS "startMileagePhoto" character varying`);
    await queryRunner.query(`ALTER TABLE "driver_days" ADD COLUMN IF NOT EXISTS "endMileagePhoto" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_days" DROP COLUMN IF EXISTS "endMileagePhoto"`);
    await queryRunner.query(`ALTER TABLE "driver_days" DROP COLUMN IF EXISTS "startMileagePhoto"`);
  }
}
