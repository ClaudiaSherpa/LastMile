import { MigrationInterface, QueryRunner } from 'typeorm';

/** Volume bonus: flat amount when packages reach a threshold. */
export class RateCardBonus1781280000000 implements MigrationInterface {
  name = 'RateCardBonus1781280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "bonusThreshold" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "bonusAmount" double precision NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rate_cards" DROP COLUMN IF EXISTS "bonusAmount"`);
    await queryRunner.query(`ALTER TABLE "rate_cards" DROP COLUMN IF EXISTS "bonusThreshold"`);
  }
}
