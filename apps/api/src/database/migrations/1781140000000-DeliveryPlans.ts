import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeliveryPlans1781140000000 implements MigrationInterface {
  name = 'DeliveryPlans1781140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "delivery_plans_status_enum" AS ENUM('draft','broadcasting','completed','cancelled')`);
    await queryRunner.query(`CREATE TYPE "delivery_plan_lines_status_enum" AS ENUM('pending','broadcasting','filled','cancelled')`);
    await queryRunner.query(`CREATE TYPE "plan_tenders_status_enum" AS ENUM('offered','accepted','auto_accepted','declined','cancelled','expired')`);

    await queryRunner.query(`
      CREATE TABLE "delivery_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reference" character varying NOT NULL,
        "name" character varying,
        "hubName" character varying NOT NULL DEFAULT 'PasarEx Hub',
        "vehicleCapacities" jsonb NOT NULL,
        "status" "delivery_plans_status_enum" NOT NULL DEFAULT 'draft',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_delivery_plans_reference" UNIQUE ("reference"),
        CONSTRAINT "PK_delivery_plans" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(`
      CREATE TABLE "delivery_plan_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "parish" character varying NOT NULL,
        "requiredPackages" integer NOT NULL,
        "acceptedPackages" integer NOT NULL DEFAULT 0,
        "preassignedDriverIds" jsonb NOT NULL DEFAULT '[]',
        "eligibleCount" integer NOT NULL DEFAULT 0,
        "broadcastOrder" integer,
        "status" "delivery_plan_lines_status_enum" NOT NULL DEFAULT 'pending',
        "planId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_delivery_plan_lines" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_delivery_plan_lines_parish" ON "delivery_plan_lines" ("parish")`);

    await queryRunner.query(`
      CREATE TABLE "plan_tenders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "packages" integer NOT NULL,
        "preassigned" boolean NOT NULL DEFAULT false,
        "status" "plan_tenders_status_enum" NOT NULL DEFAULT 'offered',
        "lineId" uuid,
        "driverId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "respondedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_plan_tenders" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(`ALTER TABLE "delivery_plan_lines" ADD CONSTRAINT "FK_dpl_plan" FOREIGN KEY ("planId") REFERENCES "delivery_plans"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "plan_tenders" ADD CONSTRAINT "FK_pt_line" FOREIGN KEY ("lineId") REFERENCES "delivery_plan_lines"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "plan_tenders" ADD CONSTRAINT "FK_pt_driver" FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_tenders" DROP CONSTRAINT "FK_pt_driver"`);
    await queryRunner.query(`ALTER TABLE "plan_tenders" DROP CONSTRAINT "FK_pt_line"`);
    await queryRunner.query(`ALTER TABLE "delivery_plan_lines" DROP CONSTRAINT "FK_dpl_plan"`);
    await queryRunner.query(`DROP TABLE "plan_tenders"`);
    await queryRunner.query(`DROP INDEX "IDX_delivery_plan_lines_parish"`);
    await queryRunner.query(`DROP TABLE "delivery_plan_lines"`);
    await queryRunner.query(`DROP TABLE "delivery_plans"`);
    await queryRunner.query(`DROP TYPE "plan_tenders_status_enum"`);
    await queryRunner.query(`DROP TYPE "delivery_plan_lines_status_enum"`);
    await queryRunner.query(`DROP TYPE "delivery_plans_status_enum"`);
  }
}
