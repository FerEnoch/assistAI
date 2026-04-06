import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load .env from project root for CLI usage (typeorm-ts-node-commonjs)
config({ path: resolve(__dirname, '../../../../.env') });

/**
 * TypeORM DataSource configuration for CLI (migrations) and runtime.
 * Uses raw SQL migrations because TypeORM's entity diff
 * does not understand pgvector's `vector` type.
 *
 * Auto-migrations: ENABLED in development, DISABLED in production.
 * Development: runs automatically on app start.
 * Production: run manually via `pnpm migration:run` in CI/CD.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: process.env.NODE_ENV === 'development', // auto-run only in dev
  synchronize: false, // NEVER auto-sync — we use explicit migrations
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],
};

/** Standalone DataSource for TypeORM CLI (typeorm-ts-node-commonjs) */
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
