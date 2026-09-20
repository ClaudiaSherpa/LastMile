import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-driver package quantities for pre-assigned drivers (Excel driver template). */
export class PreassignedPackages1781200000000 implements MigrationInterface {
  name = 'PreassignedPackages1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delivery_plan_lines" ADD COLUMN IF NOT EXISTS "preassignedPackages" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delivery_plan_lines" DROP COLUMN IF EXISTS "preassignedPackages"`);
  }
}
