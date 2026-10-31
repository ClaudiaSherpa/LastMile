import { MigrationInterface, QueryRunner } from 'typeorm';

/** Mass tenders (open calls): no route, drivers pick a hub loading slot. */
export class MassTenders1781310000000 implements MigrationInterface {
  name = 'MassTenders1781310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mass_tenders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" character varying NOT NULL,
        "name" character varying,
        "operationalDate" date NOT NULL,
        "hubName" character varying NOT NULL DEFAULT 'PasarEx Hub',
        "windowStart" character varying NOT NULL,
        "windowEnd" character varying NOT NULL,
        "slotMinutes" integer NOT NULL,
        "maxConcurrent" integer NOT NULL,
        "driversNeeded" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'draft',
        "createdBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mass_tenders_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_mass_tenders" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`
      CREATE TABLE "mass_tender_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "massTenderId" uuid NOT NULL,
        "driverId" uuid NOT NULL,
        "slotStart" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'accepted',
        "acceptedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mass_tender_acceptances" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_mass_acc_tender_driver" ON "mass_tender_acceptances" ("massTenderId", "driverId")`);
    await queryRunner.query(`ALTER TABLE "mass_tender_acceptances" ADD CONSTRAINT "FK_mass_acc_tender" FOREIGN KEY ("massTenderId") REFERENCES "mass_tenders"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "mass_tender_acceptances" ADD CONSTRAINT "FK_mass_acc_driver" FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "mass_tender_acceptances" DROP CONSTRAINT "FK_mass_acc_driver"`);
    await queryRunner.query(`ALTER TABLE "mass_tender_acceptances" DROP CONSTRAINT "FK_mass_acc_tender"`);
    await queryRunner.query(`DROP INDEX "IDX_mass_acc_tender_driver"`);
    await queryRunner.query(`DROP TABLE "mass_tender_acceptances"`);
    await queryRunner.query(`DROP TABLE "mass_tenders"`);
  }
}
