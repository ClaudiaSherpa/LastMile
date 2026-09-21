import { MigrationInterface, QueryRunner } from 'typeorm';

/** Currency code shown alongside rate-card monetary values. */
export class RateCardCurrency1781240000000 implements MigrationInterface {
  name = 'RateCardCurrency1781240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "currency" character varying NOT NULL DEFAULT 'BBD'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rate_cards" DROP COLUMN IF EXISTS "currency"`);
  }
}
