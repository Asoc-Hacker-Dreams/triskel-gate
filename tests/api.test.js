import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/routes/api.js';

// Mock de la base de datos
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  from: jest.fn(() => mockDb),
  where: jest.fn(() => mockDb),
  values: jest.fn(() => mockDb),
  set: jest.fn(() => mockDb),
  execute: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  innerJoin: jest.fn(() => mockDb),
  leftJoin: jest.fn(() => mockDb),
  groupBy: jest.fn(() => mockDb),
  orderBy: jest.fn(() => mockDb)
};

jest.unstable_mockModule('../../src/db/connection.js', () => ({
  db: mockDb
}));

// Mock de servicios
const mockTicketValidation = {
  validateTicket: jest.fn(),
  searchTickets: jest.fn(),
  getValidationStats: jest.fn()
};

jest.unstable_mockModule('../../src/services/ticketValidation.js', () => mockTicketValidation);

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/validate', () => {
    test('should validate ticket successfully', async () => {
      const mockTicket = {
        id: 1,
        code: 'TEST-2025-001',
        holderName: 'Test User',
        ticketType: 'General',
        isUsed: false
      };

      mockTicketValidation.validateTicket.mockResolvedValueOnce({
        success: true,
        ticket: mockTicket,
        message: 'Ticket válido'
      });

      const response = await request(app)
        .post('/api/validate')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          code: 'TEST-2025-001',
          validatorId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ticket.code).toBe('TEST-2025-001');
      expect(mockTicketValidation.validateTicket).toHaveBeenCalledWith(
        'TEST-2025-001',
        1
      );
    });

    test('should handle invalid ticket', async () => {
      mockTicketValidation.validateTicket.mockResolvedValueOnce({
        success: false,
        message: 'Ticket no encontrado'
      });

      const response = await request(app)
        .post('/api/validate')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({
          code: 'INVALID-CODE',
          validatorId: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Ticket no encontrado');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({
          code: 'TEST-2025-001',
          validatorId: 1
        });

      expect(response.status).toBe(401);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/validate')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/search', () => {
    test('should search tickets by code', async () => {
      const mockTickets = [
        {
          id: 1,
          code: 'TEST-2025-001',
          holderName: 'Test User',
          holderEmail: 'test@example.com',
          ticketType: 'General',
          isUsed: false
        }
      ];

      mockTicketValidation.searchTickets.mockResolvedValueOnce({
        success: true,
        tickets: mockTickets,
        total: 1
      });

      const response = await request(app)
        .get('/api/search?q=TEST-2025-001')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(1);
      expect(response.body.tickets[0].code).toBe('TEST-2025-001');
    });

    test('should search tickets by email', async () => {
      const mockTickets = [
        {
          id: 1,
          code: 'TEST-2025-001',
          holderName: 'Test User',
          holderEmail: 'test@example.com',
          ticketType: 'General',
          isUsed: false
        }
      ];

      mockTicketValidation.searchTickets.mockResolvedValueOnce({
        success: true,
        tickets: mockTickets,
        total: 1
      });

      const response = await request(app)
        .get('/api/search?q=test@example.com')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(1);
    });

    test('should handle empty search results', async () => {
      mockTicketValidation.searchTickets.mockResolvedValueOnce({
        success: true,
        tickets: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/search?q=nonexistent')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tickets).toHaveLength(0);
    });

    test('should require search query', async () => {
      const response = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/events', () => {
    test('should get public events list', async () => {
      const mockEvents = [
        {
          id: 1,
          name: 'TriskelGate 2025',
          description: 'Test event',
          date: '2025-12-31',
          venue: 'Test Venue',
          maxCapacity: 100
        }
      ];

      mockDb.all.mockResolvedValueOnce(mockEvents);

      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].name).toBe('TriskelGate 2025');
    });

    test('should handle database errors', async () => {
      mockDb.all.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/events/:id/ticket-types', () => {
    test('should get ticket types for event', async () => {
      const mockTicketTypes = [
        {
          id: 1,
          name: 'General',
          price: 50.00,
          description: 'General admission',
          maxQuantity: 100,
          soldQuantity: 25
        }
      ];

      mockDb.all.mockResolvedValueOnce(mockTicketTypes);

      const response = await request(app)
        .get('/api/events/1/ticket-types');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.ticketTypes).toHaveLength(1);
      expect(response.body.ticketTypes[0].name).toBe('General');
    });

    test('should handle invalid event ID', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/events/999/ticket-types');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stats', () => {
    test('should get validation statistics', async () => {
      const mockStats = {
        totalValidations: 150,
        todayValidations: 25,
        totalTickets: 500,
        usedTickets: 150,
        recentValidations: []
      };

      mockTicketValidation.getValidationStats.mockResolvedValueOnce({
        success: true,
        stats: mockStats
      });

      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Bearer ${global.testUtils.generateTestToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats.totalValidations).toBe(150);
      expect(response.body.stats.todayValidations).toBe(25);
    });

    test('should require authentication for stats', async () => {
      const response = await request(app)
        .get('/api/stats');

      expect(response.status).toBe(401);
    });
  });
});
