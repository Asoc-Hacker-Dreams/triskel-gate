import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as ticketValidation from '../../src/services/ticketValidation.js';

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
  orderBy: jest.fn(() => mockDb),
  limit: jest.fn(() => mockDb),
  offset: jest.fn(() => mockDb)
};

jest.unstable_mockModule('../../src/db/connection.js', () => ({
  db: mockDb
}));

// Mock de moment
const mockMoment = {
  format: jest.fn(() => '2025-06-09 12:00:00'),
  startOf: jest.fn(() => mockMoment),
  endOf: jest.fn(() => mockMoment)
};

jest.unstable_mockModule('moment', () => ({
  default: jest.fn(() => mockMoment)
}));

describe('Ticket Validation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTicket', () => {
    test('should validate ticket successfully', async () => {
      const mockTicket = {
        id: 1,
        code: 'TEST-2025-001',
        eventId: 1,
        ticketTypeId: 1,
        orderId: 1,
        holderName: 'Test User',
        holderEmail: 'test@example.com',
        isUsed: false,
        qrCodePath: '/test/qr.png',
        event: { name: 'Test Event', isActive: true },
        ticketType: { name: 'General' }
      };

      // Mock ticket encontrado y no usado
      mockDb.get.mockResolvedValueOnce(mockTicket);
      // Mock actualización exitosa
      mockDb.execute.mockResolvedValueOnce({ changes: 1 });
      // Mock inserción de log exitosa
      mockDb.execute.mockResolvedValueOnce({ changes: 1 });

      const result = await ticketValidation.validateTicket('TEST-2025-001', 1);

      expect(result.success).toBe(true);
      expect(result.ticket.code).toBe('TEST-2025-001');
      expect(result.message).toBe('Ticket validado correctamente');
      expect(mockDb.get).toHaveBeenCalled();
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // Update + Insert log
    });

    test('should reject already used ticket', async () => {
      const mockUsedTicket = {
        id: 1,
        code: 'TEST-2025-001',
        isUsed: true,
        usedAt: '2025-06-09 10:00:00',
        event: { name: 'Test Event', isActive: true }
      };

      mockDb.get.mockResolvedValueOnce(mockUsedTicket);

      const result = await ticketValidation.validateTicket('TEST-2025-001', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Este ticket ya ha sido utilizado');
      expect(result.ticket.usedAt).toBe('2025-06-09 10:00:00');
    });

    test('should reject ticket for inactive event', async () => {
      const mockTicket = {
        id: 1,
        code: 'TEST-2025-001',
        isUsed: false,
        event: { name: 'Test Event', isActive: false }
      };

      mockDb.get.mockResolvedValueOnce(mockTicket);

      const result = await ticketValidation.validateTicket('TEST-2025-001', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('El evento no está activo');
    });

    test('should handle ticket not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await ticketValidation.validateTicket('INVALID-CODE', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Ticket no encontrado');
    });

    test('should handle database errors during validation', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database connection error'));

      const result = await ticketValidation.validateTicket('TEST-2025-001', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error interno del servidor');
      expect(result.error).toBeDefined();
    });

    test('should handle update failures', async () => {
      const mockTicket = {
        id: 1,
        code: 'TEST-2025-001',
        isUsed: false,
        event: { name: 'Test Event', isActive: true },
        ticketType: { name: 'General' }
      };

      mockDb.get.mockResolvedValueOnce(mockTicket);
      mockDb.execute.mockResolvedValueOnce({ changes: 0 }); // Update failed

      const result = await ticketValidation.validateTicket('TEST-2025-001', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error actualizando el ticket');
    });
  });

  describe('searchTickets', () => {
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

      mockDb.all.mockResolvedValueOnce(mockTickets);
      mockDb.get.mockResolvedValueOnce({ count: 1 });

      const result = await ticketValidation.searchTickets('TEST-2025', 10, 0);

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.tickets[0].code).toBe('TEST-2025-001');
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

      mockDb.all.mockResolvedValueOnce(mockTickets);
      mockDb.get.mockResolvedValueOnce({ count: 1 });

      const result = await ticketValidation.searchTickets('test@example.com', 10, 0);

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].holderEmail).toBe('test@example.com');
    });

    test('should search tickets by holder name', async () => {
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

      mockDb.all.mockResolvedValueOnce(mockTickets);
      mockDb.get.mockResolvedValueOnce({ count: 1 });

      const result = await ticketValidation.searchTickets('Test User', 10, 0);

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].holderName).toBe('Test User');
    });

    test('should handle empty search results', async () => {
      mockDb.all.mockResolvedValueOnce([]);
      mockDb.get.mockResolvedValueOnce({ count: 0 });

      const result = await ticketValidation.searchTickets('nonexistent', 10, 0);

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    test('should handle pagination', async () => {
      const mockTickets = [
        {
          id: 2,
          code: 'TEST-2025-002',
          holderName: 'Test User 2',
          holderEmail: 'test2@example.com',
          ticketType: 'VIP',
          isUsed: false
        }
      ];

      mockDb.all.mockResolvedValueOnce(mockTickets);
      mockDb.get.mockResolvedValueOnce({ count: 20 });

      const result = await ticketValidation.searchTickets('TEST', 10, 10);

      expect(result.success).toBe(true);
      expect(result.tickets).toHaveLength(1);
      expect(result.total).toBe(20);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getValidationStats', () => {
    test('should get comprehensive statistics', async () => {
      // Mock estadísticas generales
      mockDb.get
        .mockResolvedValueOnce({ count: 500 }) // total tickets
        .mockResolvedValueOnce({ count: 150 }) // used tickets
        .mockResolvedValueOnce({ count: 75 })  // today validations
        .mockResolvedValueOnce({ count: 150 }); // total validations

      // Mock validaciones recientes
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          ticketCode: 'TEST-2025-001',
          holderName: 'Test User',
          validatedAt: '2025-06-09 12:00:00',
          validatorName: 'Admin User'
        }
      ]);

      // Mock estadísticas por tipo
      mockDb.all.mockResolvedValueOnce([
        {
          ticketType: 'General',
          total: 300,
          used: 90
        },
        {
          ticketType: 'VIP',
          total: 200,
          used: 60
        }
      ]);

      const result = await ticketValidation.getValidationStats();

      expect(result.success).toBe(true);
      expect(result.stats.totalTickets).toBe(500);
      expect(result.stats.usedTickets).toBe(150);
      expect(result.stats.todayValidations).toBe(75);
      expect(result.stats.totalValidations).toBe(150);
      expect(result.stats.recentValidations).toHaveLength(1);
      expect(result.stats.ticketTypeStats).toHaveLength(2);
    });

    test('should handle database errors in stats', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database error'));

      const result = await ticketValidation.getValidationStats();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error obteniendo estadísticas');
    });
  });

  describe('getTicketInfo', () => {
    test('should get detailed ticket information', async () => {
      const mockTicket = {
        id: 1,
        code: 'TEST-2025-001',
        eventId: 1,
        ticketTypeId: 1,
        orderId: 1,
        holderName: 'Test User',
        holderEmail: 'test@example.com',
        isUsed: false,
        createdAt: '2025-06-01 10:00:00',
        event: { 
          name: 'TriskelGate 2025',
          date: '2025-12-31',
          venue: 'Test Venue'
        },
        ticketType: { 
          name: 'General',
          price: 50.00 
        },
        order: {
          paymentStatus: 'paid',
          totalAmount: 50.00
        }
      };

      mockDb.get.mockResolvedValueOnce(mockTicket);

      const result = await ticketValidation.getTicketInfo('TEST-2025-001');

      expect(result.success).toBe(true);
      expect(result.ticket.code).toBe('TEST-2025-001');
      expect(result.ticket.event.name).toBe('TriskelGate 2025');
      expect(result.ticket.ticketType.name).toBe('General');
    });

    test('should handle ticket not found in getTicketInfo', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await ticketValidation.getTicketInfo('INVALID-CODE');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Ticket no encontrado');
    });
  });
});
