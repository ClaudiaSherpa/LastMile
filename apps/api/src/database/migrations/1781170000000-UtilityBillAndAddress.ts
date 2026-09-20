import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the "utility bill" onboarding document (proof of address) and a driver
 * address column. Data changes are idempotent so this can run against prod
 * (via migration:run:prod) without reseeding.
 */
export class UtilityBillAndAddress1781170000000 implements MigrationInterface {
  name = 'UtilityBillAndAddress1781170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // driver address (captured from the utility bill)
    await queryRunner.query(`ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "address" character varying`);

    // new required document type — proof of address. Relies on column defaults
    // for id/appliesTo/acceptedFileTypes/reminderOffsets/active.
    await queryRunner.query(`
      INSERT INTO "document_types" ("key", "nameEs", "nameEn", "required", "tracksExpiry", "sortOrder")
      VALUES ('utility_bill', 'Factura de servicios (comprobante de domicilio)', 'Utility bill (proof of address)', true, false, 6)
      ON CONFLICT ("key") DO NOTHING
    `);

    // require it at the automatic "Document validation" stage
    await queryRunner.query(`
      UPDATE "approval_stages"
      SET "requiredDocs" = "requiredDocs" || '["utility_bill"]'::jsonb
      WHERE "nameEn" = 'Document validation'
        AND NOT ("requiredDocs" @> '["utility_bill"]'::jsonb)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "approval_stages"
      SET "requiredDocs" = "requiredDocs" - 'utility_bill'
      WHERE "requiredDocs" @> '["utility_bill"]'::jsonb
    `);
    await queryRunner.query(`DELETE FROM "document_types" WHERE "key" = 'utility_bill'`);
    await queryRunner.query(`ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "address"`);
  }
}
