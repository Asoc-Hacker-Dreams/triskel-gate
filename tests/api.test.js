import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Chainable mock DB
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  values: jest.fn(),
  set: jest.fn(),
  returning: jest.fn(),
  innerJoin: jest.fn(),
  leftJoin: jest.fn(),
  groupBy: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn()
};
for (const key of Object.keys(mockDb)) {
  mockDb[key].mockReturnValue(mockDb);
}

jest.unstable_mockModule('../src/db/connection.js', () => ({
  db: mockDb
}));

jest.unstable_mockModule('../src/db/schema.js', () => ({
  staff: 'staff',
  events: 'events',
  tickets: 'tickets',
  ticketTypes: 'ticketTypes',
  orders: 'orders',
  validationLogs: 'validationLogs',
  salesStats: 'salesStats'
}));

jest.unstable_mockModule('drizzle-orm', () => ({
  eq: jest.fn((...args) => ({ op: 'eq', args })),
  and: jest.fn((...args) => ({ op: 'and', args })),
  or: jest.fn((...args) => ({ op: 'or', args })),
  sql: jest.fn()
}));

// Mock services
const mockTicketValidation = {
  validateTicket: jest.fn(),
  searchTickets: jest.fn(),
  getValidationStats: jest.fn(),
  invalidateTicket: jest.fn(),
  logValidation: jest.fn()
};

jest.unstable_mockModule('../src/services/ticketValidation.js', () => ({
  default: mockTicketValidation,
  TicketValidationService: jest.fn()
}));

const mockPaymentService = {
  createPaymentSession: jest.fn(),
  processSuccessfulPayment: jest.fn(),
  processRefund: jest.fn(),
  stripe: null,
  testMode: true
};

jest.unstable_mockModule('../src/services/payment.js', () => ({
  default: mockPaymentService,
  PaymentService: jest.fn()
}));

jest.unstable_mockModule('../src/services/agorapassIntegration.js', () => ({
  default: {
    issueStampForAttendee: jest.fn()
  }
}));

// Dynamic import after mocks
let apiRoutes;
beforeAll(async () => {
  const mod = await import('../src/routes/api.js');
  apiRoutes = mod.default;
});

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    for (const key of Object.keys(mockDb)) {
      mockDb[key].mockClear();
      mockDb[key].mockReturnValue(mockDb);
    }
    jest.clearAllMocks();
  });

  describe('POST /api/validate', () => {
    test('should validate ticket successfully', async () => {
      mockTicketValidation.validateTicket.mockResolvedValueOnce({
        success: true,
        ticket: {
          id: 1,
          ticketNumber: 'T-TEST-001',
          holderName: 'Test User',
          holderEmail: 'test@example.com',
          price: 50.00,
          validatedAt: new Date().toISOString()
        },
        event: { name: 'Test Event', location: 'Test Venue' },
        ticketType: { name: 'General' },
        message: 'Ticket validado correctamente'
      });

      const response = await request(app)
        .post('/api/validate')
        .send({
          qrCode: 'dGVzdC1xci1jb2Rl',
          staffId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ticket.ticketNumber).toBe('T-TEST-001');
    });

    test('should handle invalid ticket', async () => {
      mockTicketValidation.validateTicket.mockResolvedValueOnce({
        success: false,
        error: 'TICKET_NOT_FOUND',
        message: 'El código QR no corresponde a ningún ticket válido'
      });

      const response = await request(app)
        .post('/api/validate')
        .send({ qrCode: 'INVALID-QR' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/search', () => {
    test('should search tickets by email', async () => {
      // Auth middleware: db lookup
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: '[]',
        isActive: true
      }]);

      mockTicketValidation.searchTickets.mockResolvedValueOnce({
        success: true,
        tickets: [{
          id: 1,
          ticketNumber: 'T-TEST-001',
          holderName: 'Test User',
          holderEmail: 'test@example.com',
          isUsed: false
        }],
        total: 1
      });

      const response = await request(app)
        .get('/api/search?email=test@example.com')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].holderEmail).toBe('test@example.com');
    });

    test('should search tickets by ticketNumber', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: '[]',
        isActive: true
      }]);

      mockTicketValidation.searchTickets.mockResolvedValueOnce({
        success: true,
        tickets: [{
          id: 1,
          ticketNumber: 'T-TEST-001',
          holderName: 'Test User',
          holderEmail: 'test@example.com',
          isUsed: false
        }],
        total: 1
      });

      const response = await request(app)
        .get('/api/search?ticketNumber=T-TEST-001')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(1);
    });

    test('should handle empty search results', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: '[]',
        isActive: true
      }]);

      mockTicketValidation.searchTickets.mockResolvedValueOnce({
        success: true,
        tickets: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/search?email=nonexistent@example.com')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(0);
    });

    test('should require authentication for search', async () => {
      const response = await request(app)
        .get('/api/search?email=test@example.com');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/events', () => {
    test('should get active events list', async () => {
      // db.select().from(events).where()
      mockDb.where.mockResolvedValueOnce([{
        id: 1,
        name: 'TriskelGate 2025',
        description: 'Test event',
        startDate: '2025-12-31',
        location: 'Test Venue',
        status: 'active'
      }]);

      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('TriskelGate 2025');
      expect(response.body.count).toBe(1);
    });

    test('should handle database errors', async () => {
      mockDb.where.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/events/:eventId/ticket-types', () => {
    test('should get ticket types for event', async () => {
      // First query: db.select().from(events).where().limit(1) - terminal: .limit()
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        name: 'TriskelGate 2025',
        status: 'active'
      }]);

      // Second query: db.select().from(ticketTypes).where() - terminal: .where()
      // But the first .where() (mid-chain in query 1) would consume a mockResolvedValueOnce.
      // Use mockReturnValueOnce for the mid-chain .where(), then mockResolvedValueOnce for terminal.
      mockDb.where
        .mockReturnValueOnce(mockDb) // mid-chain .where() in event query (chains to .limit)
        .mockResolvedValueOnce([{    // terminal .where() in ticketTypes query
          id: 1,
          name: 'General',
          price: 50.00,
          description: 'General admission',
          isActive: true
        }]);

      const response = await request(app)
        .get('/api/events/1/ticket-types');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('General');
      expect(response.body.event).toBeDefined();
    });

    test('should handle event not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/events/999/ticket-types');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('EVENT_NOT_FOUND');
    });
  });

  describe('GET /api/stats', () => {
    test('should get validation statistics', async () => {
      // Auth middleware
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        permissions: '[]',
        isActive: true
      }]);

      mockTicketValidation.getValidationStats.mockResolvedValueOnce({
        success: true,
        stats: {
          total: 500,
          validated: 150,
          pending: 350,
          validationRate: '30.00'
        }
      });

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats.total).toBe(500);
      expect(response.body.stats.validated).toBe(150);
    });

    test('should require authentication for stats', async () => {
      const response = await request(app)
        .get('/api/stats');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
