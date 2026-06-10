import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { env } from '../config/env';

/**
 * Single TypeORM DataSource used by both the Nest runtime and the migration CLI.
 * `synchronize` is never enabled — schema changes flow through migrations so the
 * PostGIS extension and geometry columns are created deterministically.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.db.host,
  port: env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.name,
  synchronize: false,
  logging: env.nodeEnv === 'development' ? ['error', 'warn', 'migration'] : ['error'],
  entities: [path.join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
});
