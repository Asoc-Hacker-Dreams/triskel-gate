// Seed script para datos de prueba
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { 
  events, 
  ticketTypes, 
  staff, 
  settings 
} from '../src/db/schema.js';

// Cargar variables de entorno
config();

const sqlite = new Database(process.env.DATABASE_PATH || './data/platform.db');
const db = drizzle(sqlite);

async function seed() {
  console.log('🌱 Iniciando seed de la base de datos...');

  try {
    // 1. Crear evento de prueba
    console.log('📅 Creando evento de prueba...');
    const [event] = await db.insert(events).values({
      name: 'TriskelGate 2025',
      slug: 'triskelgate-2025',
      description: 'El evento de hacking más importante de Barcelona',
      location: 'Barcelona, España',
      startDate: '2025-07-15T09:00:00Z',
      endDate: '2025-07-16T18:00:00Z',
      maxTickets: 500,
      status: 'active'
    }).returning();

    console.log(`✅ Evento creado: ${event.name} (ID: ${event.id})`);

    // 2. Crear tipos de tickets
    console.log('🎫 Creando tipos de tickets...');
    const ticketTypesData = [
      {
        eventId: event.id,
        name: 'Early Bird',
        description: 'Entrada anticipada con descuento especial',
        price: 25.00,
        maxQuantity: 100,
        saleStartDate: '2025-01-01T00:00:00Z',
        saleEndDate: '2025-06-01T23:59:59Z',
        isActive: true
      },
      {
        eventId: event.id,
        name: 'General',
        description: 'Entrada general al evento',
        price: 35.00,
        maxQuantity: 300,
        saleStartDate: '2025-01-01T00:00:00Z',
        saleEndDate: '2025-07-14T23:59:59Z',
        isActive: true
      },
      {
        eventId: event.id,
        name: 'VIP',
        description: 'Entrada VIP con beneficios especiales',
        price: 75.00,
        maxQuantity: 50,
        saleStartDate: '2025-01-01T00:00:00Z',
        saleEndDate: '2025-07-14T23:59:59Z',
        isActive: true
      },
      {
        eventId: event.id,
        name: 'Estudiante',
        description: 'Entrada con descuento para estudiantes',
        price: 15.00,
        maxQuantity: 50,
        saleStartDate: '2025-01-01T00:00:00Z',
        saleEndDate: '2025-07-14T23:59:59Z',
        isActive: true
      }
    ];

    for (const ticketType of ticketTypesData) {
      const [created] = await db.insert(ticketTypes).values(ticketType).returning();
      console.log(`  ✅ ${created.name}: €${created.price}`);
    }

    // 3. Crear usuario administrador
    console.log('👤 Creando usuarios de staff...');
    const adminPassword = await bcrypt.hash('admin123', 12);
    const staffPassword = await bcrypt.hash('staff123', 12);

    const staffData = [
      {
        email: 'admin@triskelgate.com',
        name: 'Administrador TriskelGate',
        passwordHash: adminPassword,
        role: 'admin',
        permissions: JSON.stringify(['all']),
        isActive: true
      },
      {
        email: 'staff@triskelgate.com',
        name: 'Staff TriskelGate',
        passwordHash: staffPassword,
        role: 'staff',
        permissions: JSON.stringify(['validate_tickets', 'view_stats']),
        isActive: true
      },
      {
        email: 'validator@triskelgate.com',
        name: 'Validador TriskelGate',
        passwordHash: staffPassword,
        role: 'validator',
        permissions: JSON.stringify(['validate_tickets']),
        isActive: true
      }
    ];

    for (const staffMember of staffData) {
      const [created] = await db.insert(staff).values(staffMember).returning();
      console.log(`  ✅ ${created.name} (${created.role}): ${created.email}`);
    }

    // 4. Configuraciones del sistema
    console.log('⚙️ Creando configuraciones del sistema...');
    const settingsData = [
      {
        key: 'company_name',
        value: 'TriskelGate',
        category: 'general',
        description: 'Nombre de la empresa/organización',
        isPublic: true
      },
      {
        key: 'support_email',
        value: 'support@triskelgate.com',
        category: 'contact',
        description: 'Email de soporte técnico',
        isPublic: true
      },
      {
        key: 'refund_policy_days',
        value: '7',
        category: 'payment',
        description: 'Días límite para reembolsos',
        isPublic: false
      },
      {
        key: 'max_tickets_per_order',
        value: '10',
        category: 'sales',
        description: 'Máximo número de tickets por orden',
        isPublic: false
      },
      {
        key: 'enable_qr_validation',
        value: 'true',
        category: 'validation',
        description: 'Habilitar validación por código QR',
        isPublic: false
      },
      {
        key: 'event_timezone',
        value: 'Europe/Madrid',
        category: 'general',
        description: 'Zona horaria del evento',
        isPublic: true
      }
    ];

    for (const setting of settingsData) {
      const [created] = await db.insert(settings).values(setting).returning();
      console.log(`  ✅ ${created.key}: ${created.value}`);
    }

    console.log('\n🎉 Seed completado exitosamente!');
    console.log('\n📋 Datos creados:');
    console.log(`   • 1 evento: ${event.name}`);
    console.log(`   • ${ticketTypesData.length} tipos de tickets`);
    console.log(`   • ${staffData.length} usuarios de staff`);
    console.log(`   • ${settingsData.length} configuraciones`);
    console.log('\n🔐 Credenciales de acceso:');
    console.log('   Admin: admin@triskelgate.com / admin123');
    console.log('   Staff: staff@triskelgate.com / staff123');
    console.log('   Validator: validator@triskelgate.com / staff123');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

// Ejecutar seed
seed();
