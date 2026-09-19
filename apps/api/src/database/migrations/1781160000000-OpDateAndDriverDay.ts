import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpDateAndDriverDay1781160000000 implements MigrationInterface {
  name = 'OpDateAndDriverDay1781160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delivery_plans" ADD "operationalDate" date`);
    await queryRunner.query(`
      CREATE TABLE "driver_days" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driverId" uuid NOT NULL,
        "operationalDate" date NOT NULL,
        "depotArrivalAt" TIMESTAMP WITH TIME ZONE,
        "packagesPicked" integer,
        "depotDepartureAt" TIMESTAMP WITH TIME ZONE,
        "startMileage" double precision,
        "depotReturnAt" TIMESTAMP WITH TIME ZONE,
        "endMileage" double precision,
        "successfulDeliveries" integer,
        "packagesReturned" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_driver_days" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_driver_days_driver_date" ON "driver_days" ("driverId", "operationalDate")`);
    await queryRunner.query(`ALTER TABLE "driver_days" ADD CONSTRAINT "FK_dd_driver" FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_days" DROP CONSTRAINT "FK_dd_driver"`);
    await queryRunner.query(`DROP INDEX "IDX_driver_days_driver_date"`);
    await queryRunner.query(`DROP TABLE "driver_days"`);
    await queryRunner.query(`ALTER TABLE "delivery_plans" DROP COLUMN "operationalDate"`);
  }
}
