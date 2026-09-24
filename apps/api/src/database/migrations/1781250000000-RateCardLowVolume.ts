import { MigrationInterface, QueryRunner } from 'typeorm';

/** Low-volume rule: flat rate per package below a package threshold. */
export class RateCardLowVolume1781250000000 implements MigrationInterface {
  name = 'RateCardLowVolume1781250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "lowVolumeThreshold" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "lowVolumeRatePerPackage" double precision NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rate_cards" DROP COLUMN IF EXISTS "lowVolumeRatePerPackage"`);
    await queryRunner.query(`ALTER TABLE "rate_cards" DROP COLUMN IF EXISTS "lowVolumeThreshold"`);
  }
}
