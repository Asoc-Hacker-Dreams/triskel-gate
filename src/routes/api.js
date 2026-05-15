import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import ticketValidationService from '../services/ticketValidation.js';
import paymentService from '../services/payment.js';
import authMiddleware from '../middleware/auth.js';
import { subscribe as pushSubscribe, VAPID_PUBLIC } from '../services/pushNotification.js';
import { db, pool } from '../db/connection.js';
import { upsertContact } from '../services/hubspot.js';
import { events, ticketTypes, orders } from '../db/schema.js';
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
        'POST /api/payment/refund - Procesar reembolso',
        'GET /api/checkout/sessions/:sessionId/status - Estado de sesión de pago'
      ],
      system: [
        'GET /api/health - Estado del sistema',
        'GET /api/info - Información de la API'
      ]
    }
  });
});

// Checkout session status (for frontend polling after Stripe redirect)
router.get('/checkout/sessions/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'MISSING_SESSION_ID' });
    }

    // Fast path: check if order already exists and is completed in our DB
    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.stripeSessionId, sessionId))
      .limit(1);
    if (existingOrder.length > 0 && existingOrder[0].status === 'completed') {
      return res.json({ success: true, sessionId, status: 'paid', orderId: existingOrder[0].id });
    }

    // Retrieve real session status from Stripe
    if (!paymentService.stripe) {
      return res.status(503).json({
        success: false,
        error: 'STRIPE_NOT_CONFIGURED',
        message: 'Stripe is not configured (test mode or missing STRIPE_SECRET_KEY)'
      });
    }

    const session = await paymentService.stripe.checkout.sessions.retrieve(sessionId);

    return res.json({
      success: true,
      data: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email || session.customer_email,
        amount_total: session.amount_total
      }
    });
  } catch (error) {
    console.error('Error checking session status:', error);

    if (error.type === 'StripeInvalidRequestError' && error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Checkout session not found'
      });
    }
    if (error.type?.startsWith('Stripe')) {
      return res.status(502).json({
        success: false,
        error: 'STRIPE_ERROR',
        message: 'Error communicating with Stripe'
      });
    }

    res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

/**
 * BATCH VALIDATION - Upload offline validations
 */
router.post('/validate/batch',
  authMiddleware,
  async (req, res) => {
    const { validations } = req.body;

    if (!Array.isArray(validations)) {
      return res.status(400).json({ error: 'validations must be an array' });
    }

    const results = [];
    for (const v of validations) {
      try {
        const result = await ticketValidationService.validateTicket(
          v.qrCode,
          v.staffId,
          v.location,
          v.deviceInfo,
          req.ip
        );
        results.push({ qrCode: v.qrCode, ...result });
      } catch (err) {
        results.push({ qrCode: v.qrCode, success: false, error: err.message });
      }
    }

    res.json({ success: true, results, processed: results.length });
  }
);

// GET VAPID public key (public — no auth needed)
router.get('/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC || null });
});

// POST subscribe to push notifications (auth required)
router.post('/push/subscribe', authMiddleware, (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription required' });
  const userId = req.user?.id || req.user?.email;
  if (!userId) return res.status(401).json({ error: 'user identity required' });
  pushSubscribe(userId, subscription);
  res.json({ success: true });
});

/**
 * GDPR DATA SUBJECT RIGHTS (Art. 15-17)
 */

const ALLOWED_CONSENT_TYPES = ['analytics', 'marketing', 'newsletters', 'product_updates', 'partner_promos'];

// Ensure user_consents table exists at startup
pool.query(`
  CREATE TABLE IF NOT EXISTS user_consents (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    consent_type TEXT NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    method TEXT NOT NULL DEFAULT 'api',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, consent_type)
  )
`).catch(err => console.error('Could not ensure user_consents table:', err));

// GET /api/consents — return authenticated user's consent records
router.get('/consents', authMiddleware, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const result = await pool.query(
      `SELECT consent_type, granted, granted_at, method, updated_at
       FROM user_consents WHERE user_id = $1 ORDER BY consent_type`,
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching consents:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Error fetching consents' });
  }
});

// PUT /api/consents — update a single consent preference
router.put('/consents',
  authMiddleware,
  [
    body('consent_type').notEmpty().withMessage('consent_type is required'),
    body('granted').isBoolean().withMessage('granted must be a boolean'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { consent_type, granted } = req.body;
      const userId = String(req.user.id);
      const email = req.user.email;

      if (consent_type === 'essential') {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Essential consent cannot be modified' });
      }
      if (!ALLOWED_CONSENT_TYPES.includes(consent_type)) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `Invalid consent_type: ${consent_type}` });
      }

      const grantedAt = granted ? new Date().toISOString() : null;

      await pool.query(`
        INSERT INTO user_consents (user_id, email, consent_type, granted, granted_at, method, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, 'api', $6, $7)
        ON CONFLICT (user_id, consent_type)
        DO UPDATE SET granted    = EXCLUDED.granted,
                      granted_at = EXCLUDED.granted_at,
                      revoked_at = CASE WHEN NOT EXCLUDED.granted THEN now() ELSE NULL END,
                      method     = 'api',
                      updated_at = now()
      `, [userId, email, consent_type, granted, grantedAt, req.ip, req.headers['user-agent']]);

      // Sync to HubSpot if marketing or newsletter consent changed
      if (consent_type === 'marketing' || consent_type === 'newsletters') {
        try {
          const { rows: allConsents } = await pool.query(
            'SELECT consent_type, granted FROM user_consents WHERE user_id = $1',
            [userId]
          );
          const marketing = allConsents.find(c => c.consent_type === 'marketing')?.granted || false;
          const newsletters = allConsents.find(c => c.consent_type === 'newsletters')?.granted || false;
          if (marketing || newsletters) {
            upsertContact({
              email,
              firstname: req.user.name?.split(' ')[0],
              lastname: req.user.name?.split(' ').slice(1).join(' ') || undefined,
              marketingConsent: marketing,
              newsletterConsent: newsletters,
              consentDate: new Date(),
            }).catch(err => console.error('⚠️ HubSpot sync error:', err.message));
          }
        } catch (err) {
          console.error('⚠️ HubSpot sync error (non-blocking):', err.message);
        }
      }

      res.json({ success: true, data: { consent_type, granted } });
    } catch (error) {
      console.error('Error updating consent:', error);
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Error updating consent' });
    }
  }
);

// GET /api/data-export — export all personal data (Art. 15 portability)
router.get('/data-export', authMiddleware, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const email = req.user.email;

    const [userResult, consentsResult, ordersResult] = await Promise.all([
      pool.query(
        'SELECT id, email, name, role, created_at FROM staff WHERE id = $1',
        [req.user.id]
      ),
      pool.query(
        `SELECT consent_type, granted, granted_at, revoked_at, method, updated_at
         FROM user_consents WHERE user_id = $1 ORDER BY consent_type`,
        [userId]
      ),
      // Orders are financial records — included read-only, never deleted
      pool.query(`
        SELECT o.order_number, o.customer_name, o.customer_email,
               o.total_amount, o.currency, o.status, o.created_at,
               e.name AS event_name, e.start_date
        FROM orders o
        LEFT JOIN events e ON e.id = o.event_id
        WHERE o.customer_email = $1
        ORDER BY o.created_at DESC
      `, [email]),
    ]);

    const bundle = {
      profile: userResult.rows[0] || {},
      consents: consentsResult.rows,
      orders: ordersResult.rows,
      exported_at: new Date().toISOString(),
    };

    res.setHeader('Content-Disposition', 'attachment; filename="data-export.json"');
    res.json(bundle);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Error exporting data' });
  }
});

// DELETE /api/account — right to erasure (Art. 17)
// Anonymizes the staff record. Orders/tickets are retained (7-year financial records rule).
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const email = req.user.email;
    const anonymizedEmail = `anonymized-${userId}@deleted.xopsalliance.com`;

    await pool.query(
      `UPDATE staff SET email = $1, name = 'Deleted User', updated_at = now() WHERE id = $2`,
      [anonymizedEmail, req.user.id]
    );

    await pool.query(
      'DELETE FROM user_consents WHERE user_id = $1 OR email = $2',
      [userId, email]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Error deleting account' });
  }
});

export default router;
