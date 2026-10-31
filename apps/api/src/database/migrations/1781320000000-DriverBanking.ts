import { MigrationInterface, QueryRunner } from 'typeorm';

/** Banking details on the driver profile (payouts). */
export class DriverBanking1781320000000 implements MigrationInterface {
  name = 'DriverBanking1781320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "bankName" character varying`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "branchAddress" character varying`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "accountNumber" character varying`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "accountType" character varying`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "swiftCode" character varying`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "transitNumber" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "transitNumber"`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "swiftCode"`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "accountType"`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "accountNumber"`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "branchAddress"`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "bankName"`);
  }
}
