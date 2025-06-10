import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import ticketValidationService from '../services/ticketValidation.js';
import paymentService from '../services/payment.js';
import authMiddleware from '../middleware/auth.js';
import { db } from '../db/connection.js';
import { events, ticketTypes } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// Rate limiting
const validationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 validaciones por IP por ventana
  message: { error: 'Demasiadas validaciones. Intenta de nuevo en 15 minutos.' }
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // máximo 50 búsquedas por IP por ventana
  message: { error: 'Demasiadas búsquedas. Intenta de nuevo en 15 minutos.' }
});

// Middleware de validación de errores
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }
  next();
};

/**
 * RUTAS PÚBLICAS
 */

// Obtener eventos activos
router.get('/events', async (req, res) => {
  try {
    const activeEvents = await db.select().from(events).where(eq(events.status, 'active'));
    
    res.json({
      success: true,
      data: activeEvents,
      count: activeEvents.length
    });
  } catch (error) {
    console.error('Error obteniendo eventos:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error obteniendo eventos'
    });
  }
});

// Obtener tipos de tickets para un evento
router.get('/events/:eventId/ticket-types', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Verificar que el evento existe y está activo
    const event = await db.select().from(events).where(
      and(eq(events.id, eventId), eq(events.status, 'active'))
    ).limit(1);
    
    if (!event.length) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Evento no encontrado o inactivo'
      });
    }
    
    // Obtener tipos de tickets activos para el evento
    const ticketTypesData = await db.select().from(ticketTypes).where(
      and(eq(ticketTypes.eventId, eventId), eq(ticketTypes.isActive, true))
    );
    
    res.json({
      success: true,
      data: ticketTypesData,
      event: event[0],
      count: ticketTypesData.length
    });
  } catch (error) {
    console.error('Error obteniendo tipos de tickets:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error obteniendo tipos de tickets'
    });
  }
});

// Obtener información de un evento específico
router.get('/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    
    if (!event.length) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Evento no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: event[0]
    });
  } catch (error) {
    console.error('Error obteniendo evento:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error obteniendo evento'
    });
  }
});

/**
 * RUTAS DE VALIDACIÓN DE TICKETS
 */

// Validar ticket por QR
router.post('/validate',
  validationLimiter,
  [
    body('qrCode').notEmpty().withMessage('Código QR es requerido'),
    body('staffId').optional().isInt().withMessage('ID de staff debe ser un número'),
    body('location').optional().isString().withMessage('Ubicación debe ser texto'),
    body('deviceInfo').optional().isString().withMessage('Info del dispositivo debe ser texto'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { qrCode, staffId, location, deviceInfo } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const result = await ticketValidationService.validateTicket(
        qrCode,
        staffId,
        location,
        deviceInfo,
        ipAddress
      );

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error en validación:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      });
    }
  }
);

// Buscar tickets
router.get('/search',
  searchLimiter,
  authMiddleware, // Requiere autenticación
  async (req, res) => {
    try {
      const {
        email,
        ticketNumber,
        uuid,
        qrCode,
        eventId,
        isUsed,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = req.query;

      const criteria = {
        email,
        ticketNumber,
        uuid,
        qrCode,
        eventId: eventId ? parseInt(eventId) : undefined,
        isUsed: isUsed !== undefined ? isUsed === 'true' : undefined,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const result = await ticketValidationService.searchTickets(criteria);
      res.json(result);

    } catch (error) {
      console.error('Error en búsqueda:', error);
      res.status(500).json({
        success: false,
        error: 'SEARCH_ERROR',
        message: 'Error realizando búsqueda'
      });
    }
  }
);

// Obtener estadísticas de validación
router.get('/stats',
  authMiddleware,
  async (req, res) => {
    try {
      const { eventId } = req.query;
      const result = await ticketValidationService.getValidationStats(
        eventId ? parseInt(eventId) : null
      );
      res.json(result);

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'STATS_ERROR',
        message: 'Error obteniendo estadísticas'
      });
    }
  }
);

// Invalidar ticket (solo para administradores)
router.post('/invalidate',
  authMiddleware,
  [
    body('ticketId').isInt().withMessage('ID de ticket debe ser un número'),
    body('reason').optional().isString().withMessage('Razón debe ser texto'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { ticketId, reason } = req.body;
      const staffId = req.user.id;

      const result = await ticketValidationService.invalidateTicket(
        ticketId,
        staffId,
        reason
      );

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error invalidando ticket:', error);
      res.status(500).json({
        success: false,
        error: 'INVALIDATE_ERROR',
        message: 'Error invalidando ticket'
      });
    }
  }
);

/**
 * RUTAS DE PAGO
 */

// Crear sesión de pago
router.post('/payment/create-session',
  [
    body('eventId').isInt().withMessage('ID de evento requerido'),
    body('ticketTypeId').isInt().withMessage('ID de tipo de ticket requerido'),
    body('quantity').isInt({ min: 1, max: 10 }).withMessage('Cantidad debe estar entre 1 y 10'),
    body('customerEmail').isEmail().withMessage('Email válido requerido'),
    body('customerName').notEmpty().withMessage('Nombre del cliente requerido'),
    body('customerPhone').optional().isMobilePhone().withMessage('Teléfono válido'),
    body('successUrl').isURL().withMessage('URL de éxito válida requerida'),
    body('cancelUrl').isURL().withMessage('URL de cancelación válida requerida'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await paymentService.createPaymentSession(req.body);
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error creando sesión de pago:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_SESSION_ERROR',
        message: 'Error creando sesión de pago'
      });
    }
  }
);

// Webhook de Stripe
router.post('/payment/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;
      try {
        event = paymentService.stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Manejar eventos de Stripe
      switch (event.type) {
        case 'checkout.session.completed':
          await paymentService.processSuccessfulPayment(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          // Manejar pagos fallidos
          console.log('Payment failed:', event.data.object);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });

    } catch (error) {
      console.error('Error procesando webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Procesar reembolso
router.post('/payment/refund',
  authMiddleware,
  [
    body('orderId').isInt().withMessage('ID de orden requerido'),
    body('reason').optional().isString().withMessage('Razón debe ser texto'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { orderId, reason } = req.body;
      const result = await paymentService.processRefund(orderId, reason);
      
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error procesando reembolso:', error);
      res.status(500).json({
        success: false,
        error: 'REFUND_ERROR',
        message: 'Error procesando reembolso'
      });
    }
  }
);

/**
 * RUTAS DE SALUD Y INFORMACIÓN
 */

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TriskelGate Payment Platform API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Información de la API
router.get('/info', (req, res) => {
  res.json({
    name: 'TriskelGate Payment Platform',
    version: '1.0.0',
    description: 'Plataforma de pago y validación de tickets superior a Eventbrite',
    features: [
      'Validación de tickets con QR',
      'Búsqueda avanzada de tickets',
      'Procesamiento de pagos con Stripe',
      'Generación automática de PDFs',
      'Estadísticas en tiempo real',
      'Sistema de reembolsos',
      'API RESTful completa',
      'Seguridad avanzada'
    ],
    endpoints: {
      validation: [
        'POST /api/validate - Validar ticket por QR',
        'GET /api/search - Buscar tickets',
        'GET /api/stats - Estadísticas de validación',
        'POST /api/invalidate - Invalidar ticket'
      ],
      payment: [
        'POST /api/payment/create-session - Crear sesión de pago',
        'POST /api/payment/webhook - Webhook de Stripe',
        'POST /api/payment/refund - Procesar reembolso'
      ],
      system: [
        'GET /api/health - Estado del sistema',
        'GET /api/info - Información de la API'
      ]
    }
  });
});

export default router;
