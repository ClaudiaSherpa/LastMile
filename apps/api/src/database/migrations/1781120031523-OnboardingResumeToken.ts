import { MigrationInterface, QueryRunner } from "typeorm";

export class OnboardingResumeToken1781120031523 implements MigrationInterface {
    name = 'OnboardingResumeToken1781120031523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "applications" ADD "resumeToken" character varying`);
        await queryRunner.query(`ALTER TABLE "document_types" ALTER COLUMN "acceptedFileTypes" SET DEFAULT '["application/pdf","image/jpeg","image/png"]'`);
        await queryRunner.query(`ALTER TABLE "document_types" ALTER COLUMN "reminderOffsets" SET DEFAULT '[30,15,3]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_types" ALTER COLUMN "reminderOffsets" SET DEFAULT '[30, 15, 3]'`);
        await queryRunner.query(`ALTER TABLE "document_types" ALTER COLUMN "acceptedFileTypes" SET DEFAULT '["application/pdf", "image/jpeg", "image/png"]'`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "resumeToken"`);
    }

}
