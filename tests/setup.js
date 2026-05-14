import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración global para pruebas
global.__dirname = __dirname;
global.__filename = __filename;

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.DATABASE_URL = ':memory:';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'error';
process.env.PAYMENT_TEST_MODE = 'true';
process.env.QR_SECRET = 'test-qr-secret';

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

// Mock para Winston logger
jest.unstable_mockModule('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

// Mock para nodemailer
jest.unstable_mockModule('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Utilidades para pruebas
global.testUtils = {
  generateTestToken: (payload = {}) => {
    const hasExp = 'exp' in payload;
    const options = hasExp ? {} : { expiresIn: '1h' };
    return jwt.sign(
      {
        id: 1,
        email: 'test@example.com',
        role: 'admin',
        ...payload
      },
      process.env.JWT_SECRET,
      options
    );
  },

  // Known bcrypt hash of "password123" with 12 rounds
  testPasswordHash: '$2a$12$wlpI.7tuJvKTl0s9/QKIce5HvzmhUbWYgacu0YdGq0ev93Hd4HVri',

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
    uuid: 'test-uuid-001',
    ticketNumber: 'T-TEST-001',
    qrCode: 'dGVzdC1xci1jb2Rl',
    eventId: 1,
    ticketTypeId: 1,
    orderId: 1,
    holderName: 'Test User',
    holderEmail: 'test@example.com',
    isUsed: false,
    price: 50.00
  },

  mockUser: {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    isActive: true
  }
};
