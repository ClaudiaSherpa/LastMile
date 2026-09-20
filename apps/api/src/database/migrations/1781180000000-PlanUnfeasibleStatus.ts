import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds an 'unfeasible' status for delivery plans and plan lines that have no
 * eligible drivers to broadcast to. PostgreSQL enum values can be added inside
 * a transaction on PG12+ as long as they aren't used in the same transaction.
 */
export class PlanUnfeasibleStatus1781180000000 implements MigrationInterface {
  name = 'PlanUnfeasibleStatus1781180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "delivery_plans_status_enum" ADD VALUE IF NOT EXISTS 'unfeasible'`);
    await queryRunner.query(`ALTER TYPE "delivery_plan_lines_status_enum" ADD VALUE IF NOT EXISTS 'unfeasible'`);
  }

  public async down(): Promise<void> {
    // Postgres cannot drop a single enum value; leaving 'unfeasible' in place is harmless.
  }
}
