import { MigrationInterface, QueryRunner } from 'typeorm';

/** One-time invite token for admin-created staff users. */
export class UserInvite1781220000000 implements MigrationInterface {
  name = 'UserInvite1781220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteToken" character varying`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_inviteToken" ON "users" ("inviteToken")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_inviteToken"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "inviteToken"`);
  }
}
