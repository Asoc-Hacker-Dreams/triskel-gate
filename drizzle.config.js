import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config();

export default defineConfig({
  schema: './src/db/schema.js',
  out: './src/migrations-pg',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/triskell_gate'
  },
  verbose: true,
  strict: true,
  breakpoints: true
});
