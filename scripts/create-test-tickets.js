// Script para crear tickets de prueba con QR válidos
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { 
  orders, 
  tickets, 
  events, 
  ticketTypes 
} from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

// Cargar variables de entorno
config();

const sqlite = new Database(process.env.DATABASE_PATH || './data/platform.db');
const db = drizzle(sqlite);

async function createTestTickets() {
  console.log('🎫 Creando tickets de prueba...');

  try {
    // Obtener el evento y tipos de tickets
    const [event] = await db.select().from(events).limit(1);
    const ticketTypesData = await db.select().from(ticketTypes).where(eq(ticketTypes.eventId, event.id));

    if (!event || !ticketTypesData.length) {
      console.error('❌ No se encontraron eventos o tipos de tickets');
      return;
    }

    console.log(`📅 Evento: ${event.name}`);
    console.log(`🎯 Tipos de tickets disponibles: ${ticketTypesData.length}`);

    // Crear una orden de prueba
    const orderNumber = `TEST-${Date.now()}`;
    const [order] = await db.insert(orders).values({
      orderNumber,
      eventId: event.id,
      customerEmail: 'test@triskelgate.com',
      customerName: 'Usuario de Prueba',
      customerPhone: '+34600000000',
      totalAmount: 35.00,
      currency: 'EUR',
      status: 'completed',
      notes: 'Orden de prueba generada automáticamente'
    }).returning();

    console.log(`📋 Orden creada: ${order.orderNumber} (ID: ${order.id})`);

    // Crear tickets de prueba para diferentes tipos
    const testTickets = [];
    const ticketTypesToCreate = ticketTypesData.slice(0, 3); // Primeros 3 tipos

    for (let i = 0; i < ticketTypesToCreate.length; i++) {
      const ticketType = ticketTypesToCreate[i];
      const ticketUuid = uuidv4();
      const ticketNumber = `${event.slug.toUpperCase()}-${Date.now()}-${i + 1}`;
      
      // Generar código QR único
      const qrData = {
        ticketId: ticketUuid,
        eventId: event.id,
        ticketNumber: ticketNumber,
        type: ticketType.name,
        timestamp: Date.now()
      };
      
      const qrCodeString = JSON.stringify(qrData);
      
      // Crear el ticket
      const [ticket] = await db.insert(tickets).values({
        uuid: ticketUuid,
        orderId: order.id,
        ticketTypeId: ticketType.id,
        eventId: event.id,
        qrCode: qrCodeString,
        ticketNumber: ticketNumber,
        holderName: `Titular ${i + 1}`,
        holderEmail: `titular${i + 1}@triskelgate.com`,
        price: ticketType.price,
        isUsed: false,
        notes: `Ticket de prueba tipo ${ticketType.name}`
      }).returning();

      // Generar imagen QR
      const qrImagePath = path.join('./public/qr-codes', `${ticketNumber}.png`);
      
      // Crear directorio si no existe
      const qrDir = path.dirname(qrImagePath);
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }

      // Generar imagen QR
      await QRCode.toFile(qrImagePath, qrCodeString, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      testTickets.push({
        ticket,
        ticketType,
        qrCodeString,
        qrImagePath
      });

      console.log(`  ✅ ${ticket.ticketNumber}: ${ticketType.name} - €${ticketType.price}`);
    }

    // Crear un ticket ya usado para probar validaciones fallidas
    const usedTicketUuid = uuidv4();
    const usedTicketNumber = `${event.slug.toUpperCase()}-USED-${Date.now()}`;
    const usedQrData = {
      ticketId: usedTicketUuid,
      eventId: event.id,
      ticketNumber: usedTicketNumber,
      type: 'General',
      timestamp: Date.now()
    };
    
    const [usedTicket] = await db.insert(tickets).values({
      uuid: usedTicketUuid,
      orderId: order.id,
      ticketTypeId: ticketTypesData[1].id, // General
      eventId: event.id,
      qrCode: JSON.stringify(usedQrData),
      ticketNumber: usedTicketNumber,
      holderName: 'Ticket Usado',
      holderEmail: 'usado@triskelgate.com',
      price: ticketTypesData[1].price,
      isUsed: true,
      usedAt: new Date().toISOString(),
      usedBy: 'Sistema de prueba',
      checkinLocation: 'Entrada principal',
      notes: 'Ticket ya validado - para pruebas'
    }).returning();

    // Generar QR para ticket usado
    const usedQrImagePath = path.join('./public/qr-codes', `${usedTicketNumber}.png`);
    await QRCode.toFile(usedQrImagePath, JSON.stringify(usedQrData), {
      width: 300,
      margin: 2,
      color: {
        dark: '#FF0000', // Rojo para indicar que está usado
        light: '#FFFFFF'
      }
    });

    console.log(`  ❌ ${usedTicket.ticketNumber}: Ticket usado (para pruebas)`);

    // Crear archivo de resumen para fácil acceso
    const summary = {
      event: event.name,
      orderNumber: order.orderNumber,
      validTickets: testTickets.map(t => ({
        ticketNumber: t.ticket.ticketNumber,
        type: t.ticketType.name,
        price: t.ticketType.price,
        qrCode: t.qrCodeString,
        holderName: t.ticket.holderName,
        qrImageUrl: `http://localhost:3001/qr-codes/${t.ticket.ticketNumber}.png`
      })),
      usedTicket: {
        ticketNumber: usedTicket.ticketNumber,
        qrCode: JSON.stringify(usedQrData),
        status: 'USED',
        qrImageUrl: `http://localhost:3001/qr-codes/${usedTicket.ticketNumber}.png`
      },
      testInstructions: {
        validatorUrl: 'http://localhost:3001/validator.html',
        credentials: {
          admin: { email: 'admin@triskelgate.com', password: 'admin123' },
          staff: { email: 'staff@triskelgate.com', password: 'staff123' },
          validator: { email: 'validator@triskelgate.com', password: 'staff123' }
        }
      }
    };

    fs.writeFileSync('./public/test-tickets.json', JSON.stringify(summary, null, 2));

    console.log('\n🎉 Tickets de prueba creados exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   • Orden: ${order.orderNumber}`);
    console.log(`   • Tickets válidos: ${testTickets.length}`);
    console.log(`   • Tickets usados: 1`);
    console.log(`   • Códigos QR generados en: ./public/qr-codes/`);
    console.log(`   • Resumen JSON: ./public/test-tickets.json`);
    console.log('\n🔗 URLs de prueba:');
    console.log(`   • Validador: http://localhost:3001/validator.html`);
    console.log(`   • Resumen: http://localhost:3001/test-tickets.json`);
    console.log('\n🔐 Credenciales de prueba:');
    console.log('   • Admin: admin@triskelgate.com / admin123');
    console.log('   • Staff: staff@triskelgate.com / staff123');
    console.log('   • Validator: validator@triskelgate.com / staff123');
    
    console.log('\n🎫 Códigos QR para probar:');
    testTickets.forEach(t => {
      console.log(`   • ${t.ticket.ticketNumber}: ${t.qrCodeString.substring(0, 50)}...`);
    });
    console.log(`   • ${usedTicket.ticketNumber} (USADO): ${JSON.stringify(usedQrData).substring(0, 50)}...`);

  } catch (error) {
    console.error('❌ Error creando tickets de prueba:', error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

// Ejecutar
createTestTickets();
