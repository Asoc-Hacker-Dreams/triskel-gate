const path = require('path');
const fs = require('fs');

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.DATABASE_URL = ':memory:'; // Base de datos en memoria para tests
process.env.PORT = '0'; // Puerto aleatorio para tests
process.env.LOG_LEVEL = 'error'; // Solo errores en tests

// Mock para base de datos de testing
const testDbPath = path.join(__dirname, '../data/test.db');

// Limpiar base de datos de testing antes de cada suite
beforeEach(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Limpiar después de todas las pruebas
afterAll(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Utilidades para pruebas
global.testUtils = {
  // Generar token JWT de prueba
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { 
        id: 1, 
        username: 'testuser', 
        role: 'admin',
        ...payload 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },

  // Crear datos de prueba comunes
  mockEvent: {
    id: 1,
    name: 'Test Event',
    description: 'Test event description',
    date: new Date('2025-12-31'),
    venue: 'Test Venue',
    maxCapacity: 100,
    isActive: true
  },

  mockTicket: {
    id: 1,
    code: 'TEST-2025-001',
    eventId: 1,
    ticketTypeId: 1,
    orderId: 1,
    holderName: 'Test User',
    holderEmail: 'test@example.com',
    isUsed: false,
    qrCodePath: '/test/qr.png'
  },

  mockUser: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
    isActive: true
  }
};
