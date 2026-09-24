import { MigrationInterface, QueryRunner } from 'typeorm';

/** One-time password-reset token (delivered over WhatsApp). */
export class PasswordReset1781270000000 implements MigrationInterface {
  name = 'PasswordReset1781270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetToken" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetTokenExpiresAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_resetToken" ON "users" ("resetToken")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_resetToken"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "resetTokenExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "resetToken"`);
  }
}
