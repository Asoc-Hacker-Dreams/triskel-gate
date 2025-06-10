import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de base de datos con encriptación
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/platform.db');
const dbKey = process.env.DATABASE_KEY || 'triskelgate-secure-key-2025';

// Asegurar que el directorio data existe
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Configurar SQLite con WAL mode para mejor concurrencia
const sqlite = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// Configuraciones de seguridad para SQLite
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('cache_size = 1000000');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('temp_store = MEMORY');

// Encriptación básica (para producción usar SQLCipher)
if (process.env.NODE_ENV === 'production') {
  sqlite.pragma(`key = '${dbKey}'`);
}

export const db = drizzle(sqlite, { schema });

// Función para ejecutar migraciones
export async function runMigrations() {
  try {
    const migrationsFolder = path.join(__dirname, '../migrations');
    
    // En desarrollo, no ejecutar migraciones automáticamente
    // Ya usamos drizzle-kit push:sqlite para gestionar la BD
    if (process.env.NODE_ENV === 'production' && fs.existsSync(migrationsFolder)) {
      migrate(db, { migrationsFolder });
      console.log('✅ Migraciones ejecutadas correctamente');
    } else {
      console.log('ℹ️ Migraciones omitidas en desarrollo (usar npm run db:migrate)');
    }
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    throw error;
  }
}

// Función para cerrar la conexión
export function closeDatabase() {
  sqlite.close();
}

// Manejar cierre graceful
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

export { sqlite };
