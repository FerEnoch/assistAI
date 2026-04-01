import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load .env from project root for CLI usage (typeorm-ts-node-commonjs)
config({ path: resolve(__dirname, '../../../../.env') });

/**
 * TypeORM DataSource configuration for CLI (migrations) and runtime.
 * Uses raw SQL migrations because TypeORM's entity diff
 * does not understand pgvector's `vector` type.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: false,
  synchronize: false, // NEVER auto-sync — we use explicit migrations
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],
};

/** Standalone DataSource for TypeORM CLI (typeorm-ts-node-commonjs) */
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
