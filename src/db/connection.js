import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/triskell_gate';

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  ssl: false
});

export const db = drizzle(pool, { schema });

export async function runMigrations() {
  try {
    const migrationsFolder = path.join(__dirname, '../migrations-pg');
    if (fs.existsSync(migrationsFolder)) {
      await migrate(db, { migrationsFolder });
      console.log('✅ Postgres migrations executed successfully');
    } else {
      console.log('ℹ️ No migrations folder found, skipping');
    }
  } catch (error) {
    console.error('❌ Error running Postgres migrations:', error);
    throw error;
  }
}

export async function closeDatabase() {
  await pool.end();
}

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});
