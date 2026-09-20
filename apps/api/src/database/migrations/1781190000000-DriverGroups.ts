import { MigrationInterface, QueryRunner } from 'typeorm';

export class DriverGroups1781190000000 implements MigrationInterface {
  name = 'DriverGroups1781190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "driver_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "color" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_driver_groups" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`
      CREATE TABLE "driver_group_members" (
        "driverGroupId" uuid NOT NULL,
        "driverProfileId" uuid NOT NULL,
        CONSTRAINT "PK_driver_group_members" PRIMARY KEY ("driverGroupId", "driverProfileId")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_dgm_group" ON "driver_group_members" ("driverGroupId")`);
    await queryRunner.query(`CREATE INDEX "IDX_dgm_driver" ON "driver_group_members" ("driverProfileId")`);
    await queryRunner.query(`ALTER TABLE "driver_group_members" ADD CONSTRAINT "FK_dgm_group" FOREIGN KEY ("driverGroupId") REFERENCES "driver_groups"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "driver_group_members" ADD CONSTRAINT "FK_dgm_driver" FOREIGN KEY ("driverProfileId") REFERENCES "driver_profiles"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "driver_group_members" DROP CONSTRAINT "FK_dgm_driver"`);
    await queryRunner.query(`ALTER TABLE "driver_group_members" DROP CONSTRAINT "FK_dgm_group"`);
    await queryRunner.query(`DROP TABLE "driver_group_members"`);
    await queryRunner.query(`DROP TABLE "driver_groups"`);
  }
}
