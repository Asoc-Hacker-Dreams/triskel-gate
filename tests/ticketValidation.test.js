import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';

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
  execute: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  innerJoin: jest.fn(),
  leftJoin: jest.fn(),
  groupBy: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  offset: jest.fn()
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

jest.unstable_mockModule('../src/services/agorapassIntegration.js', () => ({
  default: {
    issueStampForAttendee: jest.fn()
  }
}));

// Dynamic import after mocks
let ticketValidationService;
beforeAll(async () => {
  const mod = await import('../src/services/ticketValidation.js');
  ticketValidationService = mod.default;
});

describe('Ticket Validation Service', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockDb)) {
      mockDb[key].mockClear();
      mockDb[key].mockReturnValue(mockDb);
    }
  });

  describe('validateTicket', () => {
    test('should validate ticket successfully', async () => {
      const mockTicket = {
        id: 1,
        uuid: 'test-uuid-001',
        ticketNumber: 'T-TEST-001',
        qrCode: 'dGVzdC1xci1jb2Rl',
        eventId: 1,
        ticketTypeId: 1,
        holderName: 'Test User',
        holderEmail: 'test@example.com',
        isUsed: false,
        price: 50.00
      };

      const mockEvent = {
        name: 'Test Event',
        status: 'active',
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString(),
        location: 'Test Venue'
      };

      const mockTicketType = {
        name: 'General',
        description: 'General admission'
      };

      // db.select().from(tickets).innerJoin().innerJoin().where().limit()
      mockDb.limit.mockResolvedValueOnce([{
        ticket: mockTicket,
        event: mockEvent,
        ticketType: mockTicketType
      }]);

      // db.update(tickets).set().where().returning()
      mockDb.returning.mockResolvedValueOnce([{
        ...mockTicket,
        isUsed: true,
        usedAt: new Date().toISOString()
      }]);

      // logValidation: db.insert(validationLogs).values()
      // It resolves the insert chain
      mockDb.values.mockResolvedValueOnce({ changes: 1 });

      const result = await ticketValidationService.validateTicket('dGVzdC1xci1jb2Rl', 1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Ticket validado correctamente');
      expect(result.ticket.ticketNumber).toBe('T-TEST-001');
      expect(result.ticket.holderName).toBe('Test User');
    });

    test('should reject already used ticket', async () => {
      const mockTicket = {
        id: 1,
        ticketNumber: 'T-TEST-001',
        qrCode: 'dGVzdC1xci1jb2Rl',
        isUsed: true,
        usedAt: '2025-06-09 10:00:00',
        usedBy: '1'
      };

      const mockEvent = {
        name: 'Test Event',
        status: 'active',
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 3600000).toISOString()
      };

      const mockTicketType = { name: 'General' };

      mockDb.limit.mockResolvedValueOnce([{
        ticket: mockTicket,
        event: mockEvent,
        ticketType: mockTicketType
      }]);

      // logValidation
      mockDb.values.mockResolvedValueOnce({ changes: 1 });

      const result = await ticketValidationService.validateTicket('dGVzdC1xci1jb2Rl', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('TICKET_ALREADY_USED');
      expect(result.message).toBe('Este ticket ya ha sido utilizado');
      expect(result.usedAt).toBe('2025-06-09 10:00:00');
    });

    test('should handle ticket not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      // logValidation
      mockDb.values.mockResolvedValueOnce({ changes: 1 });

      const result = await ticketValidationService.validateTicket('INVALID-QR', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('TICKET_NOT_FOUND');
    });

    test('should handle database errors during validation', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('Database connection error'));

      // logValidation
      mockDb.values.mockResolvedValueOnce({ changes: 1 });

      const result = await ticketValidationService.validateTicket('dGVzdC1xci1jb2Rl', 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('Error interno del sistema');
    });
  });

  describe('searchTickets', () => {
    test('should search tickets by email', async () => {
      const mockResults = [
        {
          ticket: {
            id: 1,
            uuid: 'test-uuid-001',
            ticketNumber: 'T-TEST-001',
            qrCode: 'dGVzdC1xci1jb2Rl',
            holderName: 'Test User',
            holderEmail: 'test@example.com',
            price: 50.00,
            isUsed: false,
            usedAt: null,
            usedBy: null,
            checkInLocation: null,
            createdAt: '2025-06-01'
          },
          event: {
            id: 1,
            name: 'Test Event',
            location: 'Test Venue',
            startDate: '2025-12-31',
            endDate: '2025-12-31'
          },
          ticketType: {
            id: 1,
            name: 'General',
            description: 'General admission',
            price: 50.00
          }
        }
      ];

      // searchTickets: db.select().from().innerJoin().innerJoin().where().limit().offset()
      mockDb.offset.mockResolvedValueOnce(mockResults);

      const result = await ticketValidationService.searchTickets({
        email: 'test@example.com',
        limit: 50,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].holderEmail).toBe('test@example.com');
      expect(result.tickets[0].ticketNumber).toBe('T-TEST-001');
    });

    test('should search tickets by ticketNumber', async () => {
      const mockResults = [
        {
          ticket: {
            id: 1,
            uuid: 'test-uuid-001',
            ticketNumber: 'T-TEST-001',
            qrCode: 'dGVzdC1xci1jb2Rl',
            holderName: 'Test User',
            holderEmail: 'test@example.com',
            price: 50.00,
            isUsed: false,
            usedAt: null,
            usedBy: null,
            checkInLocation: null,
            createdAt: '2025-06-01'
          },
          event: {
            id: 1,
            name: 'Test Event',
            location: 'Test Venue',
            startDate: '2025-12-31',
            endDate: '2025-12-31'
          },
          ticketType: {
            id: 1,
            name: 'General',
            description: 'General admission',
            price: 50.00
          }
        }
      ];

      mockDb.offset.mockResolvedValueOnce(mockResults);

      const result = await ticketValidationService.searchTickets({
        ticketNumber: 'T-TEST-001',
        limit: 50,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].ticketNumber).toBe('T-TEST-001');
    });

    test('should handle empty search results', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const result = await ticketValidationService.searchTickets({
        email: 'nonexistent@example.com',
        limit: 50,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getValidationStats', () => {
    test('should get validation statistics', async () => {
      // getValidationStats: db.select().from(tickets) then optionally .where()
      // When eventId provided, calls .where()
      mockDb.where.mockResolvedValueOnce([
        { total: 1, used: true, eventId: 1 },
        { total: 2, used: true, eventId: 1 },
        { total: 3, used: false, eventId: 1 },
        { total: 4, used: false, eventId: 1 },
        { total: 5, used: false, eventId: 1 }
      ]);

      const result = await ticketValidationService.getValidationStats(1);

      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(5);
      expect(result.stats.validated).toBe(2);
      expect(result.stats.pending).toBe(3);
      expect(result.stats.validationRate).toBeDefined();
    });

    test('should handle database errors in stats', async () => {
      mockDb.where.mockRejectedValueOnce(new Error('Database error'));

      const result = await ticketValidationService.getValidationStats(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('STATS_ERROR');
      expect(result.message).toBe('Error obteniendo estadísticas');
    });
  });

  describe('invalidateTicket', () => {
    test('should invalidate ticket successfully', async () => {
      // select ticket: db.select().from().where().limit(1) - terminal: .limit()
      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        ticketNumber: 'T-TEST-001',
        isUsed: true
      }]);
      // update ticket: db.update().set().where() - .where() returns mockDb (default, fine)
      // logValidation: db.insert().values() - .values() returns mockDb (default, fine)

      const result = await ticketValidationService.invalidateTicket(1, 1, 'Test reason');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Ticket invalidado correctamente');
    });

    test('should handle ticket not found in invalidate', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await ticketValidationService.invalidateTicket(999, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('TICKET_NOT_FOUND');
      expect(result.message).toBe('Ticket no encontrado');
    });
  });
});
