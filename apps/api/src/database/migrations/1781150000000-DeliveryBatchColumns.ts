import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeliveryBatchColumns1781150000000 implements MigrationInterface {
  name = 'DeliveryBatchColumns1781150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deliveries" ADD "parish" character varying`);
    await queryRunner.query(`ALTER TABLE "deliveries" ADD "packages" integer`);
    await queryRunner.query(`ALTER TABLE "deliveries" ADD "planTenderId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deliveries" DROP COLUMN "planTenderId"`);
    await queryRunner.query(`ALTER TABLE "deliveries" DROP COLUMN "packages"`);
    await queryRunner.query(`ALTER TABLE "deliveries" DROP COLUMN "parish"`);
  }
}
