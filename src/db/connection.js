import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/triskell_gate';

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  ssl: false
});

export const db = drizzle(pool, { schema });

export async function closeDatabase() {
  await pool.end();
}

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});
