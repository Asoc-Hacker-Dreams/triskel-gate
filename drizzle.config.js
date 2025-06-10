import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Cargar variables de entorno
config();

export default defineConfig({
  schema: './src/db/schema.js',
  out: './src/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/platform.db',
  },
  verbose: true,
  strict: true,
  // Configuración adicional para SQLite
  breakpoints: true,
  migrations: {
    prefix: 'index',
    table: '__drizzle_migrations__',
    schema: 'public',
  },
});
