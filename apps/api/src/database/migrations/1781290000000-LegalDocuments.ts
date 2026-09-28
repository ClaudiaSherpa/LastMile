import { MigrationInterface, QueryRunner } from 'typeorm';

/** Versioned legal content (terms / privacy / requirements) editable by admins. */
export class LegalDocuments1781290000000 implements MigrationInterface {
  name = 'LegalDocuments1781290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "legal_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying NOT NULL,
        "version" integer NOT NULL,
        "sections" jsonb NOT NULL,
        "current" boolean NOT NULL DEFAULT false,
        "publishedBy" character varying,
        "publishedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_legal_documents" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_legal_type_current" ON "legal_documents" ("type", "current")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_legal_type_version" ON "legal_documents" ("type", "version")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_legal_type_version"`);
    await queryRunner.query(`DROP INDEX "IDX_legal_type_current"`);
    await queryRunner.query(`DROP TABLE "legal_documents"`);
  }
}
