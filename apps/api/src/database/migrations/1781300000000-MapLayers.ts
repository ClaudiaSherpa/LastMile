import { MigrationInterface, QueryRunner } from 'typeorm';

/** Admin-managed map overlays (e.g. Sub-Zones) imported from KML/KMZ. */
export class MapLayers1781300000000 implements MigrationInterface {
  name = 'MapLayers1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "map_layers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying NOT NULL,
        "name" character varying NOT NULL,
        "features" jsonb NOT NULL,
        "color" character varying NOT NULL DEFAULT '#2563eb',
        "visible" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_map_layers" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_map_layers_slug" ON "map_layers" ("slug")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_map_layers_slug"`);
    await queryRunner.query(`DROP TABLE "map_layers"`);
  }
}
