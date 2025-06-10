import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as paymentService from '../../src/services/payment.js';

// Mock de Stripe
const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn()
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  refunds: {
    create: jest.fn()
  }
};

jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => mockStripe)
}));

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
  transaction: jest.fn()
};

jest.unstable_mockModule('../../src/db/connection.js', () => ({
  db: mockDb
}));

describe('Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    test('should create payment intent successfully', async () => {
      const mockOrderData = {
        eventId: 1,
        ticketTypeId: 1,
        quantity: 2,
        customerInfo: {
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      const mockTicketType = {
        id: 1,
        name: 'General',
        price: 50.00,
        maxQuantity: 100
      };

      const mockEvent = {
        id: 1,
        name: 'TriskelGate 2025',
        isActive: true
      };

      mockDb.get
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(mockTicketType);

      mockStripe.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_test',
        amount: 10000, // $100.00 (2 x $50.00)
        currency: 'eur',
        status: 'requires_payment_method'
      });

      // Mock inserción de orden
      mockDb.execute.mockResolvedValueOnce({ 
        lastInsertRowid: 1,
        changes: 1 
      });

      const result = await paymentService.createPaymentIntent(mockOrderData);

      expect(result.success).toBe(true);
      expect(result.paymentIntent.id).toBe('pi_test_123');
      expect(result.paymentIntent.client_secret).toBe('pi_test_123_secret_test');
      expect(result.orderId).toBe(1);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 10000,
        currency: 'eur',
        metadata: {
          eventId: '1',
          ticketTypeId: '1',
          quantity: '2',
          orderId: '1'
        },
        description: 'TriskelGate 2025 - General (x2)'
      });
    });

    test('should reject inactive event', async () => {
      const mockOrderData = {
        eventId: 1,
        ticketTypeId: 1,
        quantity: 1,
        customerInfo: {
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        name: 'TriskelGate 2025',
        isActive: false
      });

      const result = await paymentService.createPaymentIntent(mockOrderData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('El evento no está disponible para compra');
    });

    test('should reject insufficient ticket availability', async () => {
      const mockOrderData = {
        eventId: 1,
        ticketTypeId: 1,
        quantity: 10,
        customerInfo: {
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      const mockEvent = {
        id: 1,
        name: 'TriskelGate 2025',
        isActive: true
      };

      const mockTicketType = {
        id: 1,
        name: 'General',
        price: 50.00,
        maxQuantity: 100,
        soldQuantity: 95 // Solo quedan 5 disponibles
      };

      mockDb.get
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(mockTicketType);

      const result = await paymentService.createPaymentIntent(mockOrderData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No hay suficientes tickets disponibles');
      expect(result.available).toBe(5);
    });

    test('should handle Stripe errors', async () => {
      const mockOrderData = {
        eventId: 1,
        ticketTypeId: 1,
        quantity: 1,
        customerInfo: {
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      mockDb.get
        .mockResolvedValueOnce({ id: 1, name: 'Test Event', isActive: true })
        .mockResolvedValueOnce({ id: 1, name: 'General', price: 50.00, maxQuantity: 100 });

      mockDb.execute.mockResolvedValueOnce({ lastInsertRowid: 1, changes: 1 });

      mockStripe.paymentIntents.create.mockRejectedValueOnce(
        new Error('Your card was declined.')
      );

      const result = await paymentService.createPaymentIntent(mockOrderData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error procesando el pago');
      expect(result.error).toBeDefined();
    });
  });

  describe('confirmPayment', () => {
    test('should confirm payment and generate tickets', async () => {
      const mockOrder = {
        id: 1,
        eventId: 1,
        ticketTypeId: 1,
        quantity: 2,
        paymentIntentId: 'pi_test_123',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        paymentStatus: 'pending'
      };

      const mockEvent = {
        id: 1,
        name: 'TriskelGate 2025'
      };

      const mockTicketType = {
        id: 1,
        name: 'General'
      };

      mockDb.get
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(mockTicketType);

      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_test_123',
        status: 'succeeded',
        amount_received: 10000
      });

      // Mock transacción
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        await callback();
        return { success: true };
      });

      // Mock actualizaciones
      mockDb.execute
        .mockResolvedValueOnce({ changes: 1 }) // Update order
        .mockResolvedValueOnce({ lastInsertRowid: 1 }) // Insert ticket 1
        .mockResolvedValueOnce({ lastInsertRowid: 2 }) // Insert ticket 2
        .mockResolvedValueOnce({ changes: 1 }); // Update ticket type stats

      const result = await paymentService.confirmPayment('pi_test_123');

      expect(result.success).toBe(true);
      expect(result.order.id).toBe(1);
      expect(result.tickets).toHaveLength(2);
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test_123');
    });

    test('should handle payment not succeeded', async () => {
      const mockOrder = {
        id: 1,
        paymentIntentId: 'pi_test_123',
        paymentStatus: 'pending'
      };

      mockDb.get.mockResolvedValueOnce(mockOrder);

      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_test_123',
        status: 'requires_payment_method'
      });

      const result = await paymentService.confirmPayment('pi_test_123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('El pago no se ha completado');
    });

    test('should handle order not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await paymentService.confirmPayment('pi_invalid_123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Orden no encontrada');
    });

    test('should handle already processed payment', async () => {
      const mockOrder = {
        id: 1,
        paymentIntentId: 'pi_test_123',
        paymentStatus: 'completed'
      };

      mockDb.get.mockResolvedValueOnce(mockOrder);

      const result = await paymentService.confirmPayment('pi_test_123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Esta orden ya ha sido procesada');
    });
  });

  describe('processRefund', () => {
    test('should process refund successfully', async () => {
      const mockOrder = {
        id: 1,
        paymentIntentId: 'pi_test_123',
        paymentStatus: 'completed',
        totalAmount: 100.00
      };

      mockDb.get.mockResolvedValueOnce(mockOrder);

      mockStripe.refunds.create.mockResolvedValueOnce({
        id: 're_test_123',
        amount: 10000,
        status: 'succeeded'
      });

      mockDb.execute.mockResolvedValueOnce({ changes: 1 });

      const result = await paymentService.processRefund(1, 'Test refund reason');

      expect(result.success).toBe(true);
      expect(result.refund.id).toBe('re_test_123');
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        reason: 'requested_by_customer',
        metadata: {
          orderId: '1',
          refundReason: 'Test refund reason'
        }
      });
    });

    test('should reject refund for non-completed payment', async () => {
      const mockOrder = {
        id: 1,
        paymentIntentId: 'pi_test_123',
        paymentStatus: 'pending'
      };

      mockDb.get.mockResolvedValueOnce(mockOrder);

      const result = await paymentService.processRefund(1, 'Test reason');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Solo se pueden reembolsar pagos completados');
    });
  });

  describe('getOrderStatus', () => {
    test('should get order status with tickets', async () => {
      const mockOrder = {
        id: 1,
        paymentIntentId: 'pi_test_123',
        paymentStatus: 'completed',
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        totalAmount: 100.00
      };

      const mockTickets = [
        {
          id: 1,
          code: 'TEST-2025-001',
          isUsed: false,
          qrCodePath: '/qr/test1.png'
        },
        {
          id: 2,
          code: 'TEST-2025-002',
          isUsed: false,
          qrCodePath: '/qr/test2.png'
        }
      ];

      mockDb.get.mockResolvedValueOnce(mockOrder);
      mockDb.all.mockResolvedValueOnce(mockTickets);

      const result = await paymentService.getOrderStatus(1);

      expect(result.success).toBe(true);
      expect(result.order.id).toBe(1);
      expect(result.tickets).toHaveLength(2);
    });

    test('should handle order not found in getOrderStatus', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await paymentService.getOrderStatus(999);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Orden no encontrada');
    });
  });
});
