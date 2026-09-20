import { MigrationInterface, QueryRunner } from 'typeorm';

export class RateCards1781230000000 implements MigrationInterface {
  name = 'RateCards1781230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rate_cards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "isDefault" boolean NOT NULL DEFAULT false,
        "validFrom" date,
        "validTo" date,
        "minPackages" integer NOT NULL DEFAULT 0,
        "fixedRate" double precision NOT NULL DEFAULT 0,
        "ratePerPackage" double precision NOT NULL DEFAULT 0,
        "ratePerKg" double precision NOT NULL DEFAULT 0,
        "ratePerKm" double precision NOT NULL DEFAULT 0,
        "avgWeightKg" double precision NOT NULL DEFAULT 0,
        "avgDistanceKm" double precision NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_cards" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "rateCardId" uuid`);
    await queryRunner.query(`ALTER TABLE "plan_tenders" ADD COLUMN IF NOT EXISTS "estimate" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_tenders" DROP COLUMN IF EXISTS "estimate"`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "rateCardId"`);
    await queryRunner.query(`DROP TABLE "rate_cards"`);
  }
}
