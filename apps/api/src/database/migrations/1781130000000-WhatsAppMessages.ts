import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsAppMessages1781130000000 implements MigrationInterface {
  name = 'WhatsAppMessages1781130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "whatsapp_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "direction" character varying NOT NULL,
        "contact" character varying NOT NULL,
        "body" text,
        "status" character varying NOT NULL DEFAULT 'received',
        "providerMessageId" character varying,
        "driverId" uuid,
        "raw" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_messages" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_messages_contact" ON "whatsapp_messages" ("contact")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_whatsapp_messages_contact"`);
    await queryRunner.query(`DROP TABLE "whatsapp_messages"`);
  }
}
