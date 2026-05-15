import express from 'express';
import { body, query, validationResult } from 'express-validator';
import authMiddleware, { AuthService } from '../middleware/auth.js';
import { db } from '../db/connection.js';
import { events, ticketTypes, orders, tickets, staff, validationLogs, salesStats } from '../db/schema.js';
import { eq, desc, count, sum, and, gte, lte, like } from 'drizzle-orm';
import { syncEvent, cancelEvent } from '../services/hubspotEvents.js';

const router = express.Router();

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

// Middleware de autenticación para todas las rutas del admin
router.use(authMiddleware);

/**
 * DASHBOARD - Estadísticas generales
 */
router.get('/dashboard',
  AuthService.requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      // Estadísticas básicas
      const [
        totalEvents,
        totalTickets,
        totalRevenue,
        totalValidated,
        recentOrders,
        topEvents
      ] = await Promise.all([
        // Total de eventos
        db.select({ count: count() }).from(events),
        
        // Total de tickets
        db.select({ count: count() }).from(tickets),
        
        // Revenue total
        db.select({ total: sum(orders.totalAmount) })
          .from(orders)
          .where(eq(orders.status, 'completed')),
        
        // Tickets validados
        db.select({ count: count() })
          .from(tickets)
          .where(eq(tickets.isUsed, true)),
        
        // Órdenes recientes
        db.select({
          order: orders,
          eventName: events.name
        })
        .from(orders)
        .innerJoin(events, eq(orders.eventId, events.id))
        .orderBy(desc(orders.createdAt))
        .limit(10),
        
        // Eventos más populares
        db.select({
          eventId: tickets.eventId,
          eventName: events.name,
          ticketCount: count(tickets.id),
          revenue: sum(tickets.price)
        })
        .from(tickets)
        .innerJoin(events, eq(tickets.eventId, events.id))
        .groupBy(tickets.eventId, events.name)
        .orderBy(desc(count(tickets.id)))
        .limit(5)
      ]);

      const dashboardData = {
        overview: {
          totalEvents: totalEvents[0].count,
          totalTickets: totalTickets[0].count,
          totalRevenue: totalRevenue[0].total || 0,
          totalValidated: totalValidated[0].count,
          validationRate: totalTickets[0].count > 0 
            ? ((totalValidated[0].count / totalTickets[0].count) * 100).toFixed(2) 
            : 0
        },
        recentActivity: {
          orders: recentOrders.map(({ order, eventName }) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            eventName,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            totalAmount: order.totalAmount,
            status: order.status,
            createdAt: order.createdAt
          }))
        },
        topEvents: topEvents.map(event => ({
          eventId: event.eventId,
          eventName: event.eventName,
          ticketCount: event.ticketCount,
          revenue: event.revenue || 0
        }))
      };

      res.json({
        success: true,
        dashboard: dashboardData
      });

    } catch (error) {
      console.error('Error obteniendo dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'DASHBOARD_ERROR',
        message: 'Error obteniendo datos del dashboard'
      });
    }
  }
);

/**
 * GESTIÓN DE EVENTOS
 */

// Listar eventos
router.get('/events',
  AuthService.requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = db.select().from(events);

      if (status) {
        query = query.where(eq(events.status, status));
      }

      const eventsList = await query
        .orderBy(desc(events.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      res.json({
        success: true,
        events: eventsList
      });

    } catch (error) {
      console.error('Error obteniendo eventos:', error);
      res.status(500).json({
        success: false,
        error: 'EVENTS_ERROR',
        message: 'Error obteniendo eventos'
      });
    }
  }
);

// Crear evento
router.post('/events',
  AuthService.requireRole(['admin']),
  [
    body('name').notEmpty().withMessage('Nombre del evento requerido'),
    body('slug').notEmpty().withMessage('Slug del evento requerido'),
    body('location').notEmpty().withMessage('Ubicación requerida'),
    body('startDate').isISO8601().withMessage('Fecha de inicio válida requerida'),
    body('endDate').isISO8601().withMessage('Fecha de fin válida requerida'),
    body('maxTickets').optional().isInt({ min: 1 }).withMessage('Máximo de tickets debe ser un número positivo')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { startDate, endDate, ...rest } = req.body;
      const eventData = {
        ...rest,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newEvent = await db
        .insert(events)
        .values(eventData)
        .returning();

      // Sync to HubSpot Marketing Events (non-blocking)
      syncEvent(newEvent[0]).catch(e => console.error('⚠️ HubSpot event sync error:', e.message));

      res.status(201).json({
        success: true,
        event: newEvent[0]
      });

    } catch (error) {
      console.error('Error creando evento:', error);
      res.status(500).json({
        success: false,
        error: 'CREATE_EVENT_ERROR',
        message: 'Error creando evento'
      });
    }
  }
);

/**
 * GESTIÓN DE TIPOS DE TICKETS
 */

// Listar tipos de tickets
router.get('/ticket-types',
  AuthService.requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { eventId } = req.query;

      let query = db.select({
        ticketType: ticketTypes,
        event: events
      })
      .from(ticketTypes)
      .innerJoin(events, eq(ticketTypes.eventId, events.id));

      if (eventId) {
        query = query.where(eq(ticketTypes.eventId, parseInt(eventId)));
      }

      const types = await query.orderBy(desc(ticketTypes.createdAt));

      res.json({
        success: true,
        ticketTypes: types.map(({ ticketType, event }) => ({
          ...ticketType,
          eventName: event.name
        }))
      });

    } catch (error) {
      console.error('Error obteniendo tipos de tickets:', error);
      res.status(500).json({
        success: false,
        error: 'TICKET_TYPES_ERROR',
        message: 'Error obteniendo tipos de tickets'
      });
    }
  }
);

// Crear tipo de ticket
router.post('/ticket-types',
  AuthService.requireRole(['admin']),
  [
    body('eventId').isInt().withMessage('ID de evento requerido'),
    body('name').notEmpty().withMessage('Nombre del tipo de ticket requerido'),
    body('price').isFloat({ min: 0 }).withMessage('Precio debe ser un número positivo'),
    body('maxQuantity').optional().isInt({ min: 1 }).withMessage('Cantidad máxima debe ser un número positivo'),
    body('saleStartDate').isISO8601().withMessage('Fecha de inicio de venta válida requerida'),
    body('saleEndDate').isISO8601().withMessage('Fecha de fin de venta válida requerida')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { saleStartDate, saleEndDate, ...ttRest } = req.body;
      const ticketTypeData = {
        ...ttRest,
        saleStartDate: new Date(saleStartDate),
        saleEndDate: new Date(saleEndDate),
        isActive: true,
        createdAt: new Date()
      };

      const newTicketType = await db
        .insert(ticketTypes)
        .values(ticketTypeData)
        .returning();

      res.status(201).json({
        success: true,
        ticketType: newTicketType[0]
      });

    } catch (error) {
      console.error('Error creando tipo de ticket:', error);
      res.status(500).json({
        success: false,
        error: 'CREATE_TICKET_TYPE_ERROR',
        message: 'Error creando tipo de ticket'
      });
    }
  }
);

/**
 * GESTIÓN DE ÓRDENES
 */

// Listar órdenes
router.get('/orders',
  AuthService.requireRole(['admin', 'staff']),
  [
    query('status').optional().isIn(['pending', 'completed', 'cancelled', 'refunded']),
    query('eventId').optional().isInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, eventId, email, limit = 50, offset = 0 } = req.query;

      let query = db.select({
        order: orders,
        event: events
      })
      .from(orders)
      .innerJoin(events, eq(orders.eventId, events.id));

      const conditions = [];
      if (status) conditions.push(eq(orders.status, status));
      if (eventId) conditions.push(eq(orders.eventId, parseInt(eventId)));
      if (email) conditions.push(like(orders.customerEmail, `%${email}%`));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const ordersList = await query
        .orderBy(desc(orders.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      res.json({
        success: true,
        orders: ordersList.map(({ order, event }) => ({
          ...order,
          eventName: event.name
        }))
      });

    } catch (error) {
      console.error('Error obteniendo órdenes:', error);
      res.status(500).json({
        success: false,
        error: 'ORDERS_ERROR',
        message: 'Error obteniendo órdenes'
      });
    }
  }
);

// Obtener detalles de una orden
router.get('/orders/:orderId',
  AuthService.requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);

      const orderDetails = await db.select({
        order: orders,
        event: events,
        tickets: tickets
      })
      .from(orders)
      .innerJoin(events, eq(orders.eventId, events.id))
      .leftJoin(tickets, eq(tickets.orderId, orders.id))
      .where(eq(orders.id, orderId));

      if (orderDetails.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: 'Orden no encontrada'
        });
      }

      const order = orderDetails[0].order;
      const event = orderDetails[0].event;
      const orderTickets = orderDetails
        .filter(detail => detail.tickets)
        .map(detail => detail.tickets);

      res.json({
        success: true,
        order: {
          ...order,
          event,
          tickets: orderTickets
        }
      });

    } catch (error) {
      console.error('Error obteniendo detalles de orden:', error);
      res.status(500).json({
        success: false,
        error: 'ORDER_DETAILS_ERROR',
        message: 'Error obteniendo detalles de orden'
      });
    }
  }
);

/**
 * ANÁLISIS Y REPORTES
 */

// Estadísticas de ventas
router.get('/analytics/sales',
  AuthService.requireRole(['admin', 'staff']),
  [
    query('eventId').optional().isInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId, startDate, endDate } = req.query;

      let query = db.select({
        date: salesStats.date,
        eventId: salesStats.eventId,
        eventName: events.name,
        ticketsSold: salesStats.ticketsSold,
        revenue: salesStats.revenue,
        refunds: salesStats.refunds
      })
      .from(salesStats)
      .innerJoin(events, eq(salesStats.eventId, events.id));

      const conditions = [];
      if (eventId) conditions.push(eq(salesStats.eventId, parseInt(eventId)));
      if (startDate) conditions.push(gte(salesStats.date, startDate));
      if (endDate) conditions.push(lte(salesStats.date, endDate));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const salesData = await query.orderBy(desc(salesStats.date));

      res.json({
        success: true,
        salesAnalytics: salesData
      });

    } catch (error) {
      console.error('Error obteniendo análisis de ventas:', error);
      res.status(500).json({
        success: false,
        error: 'SALES_ANALYTICS_ERROR',
        message: 'Error obteniendo análisis de ventas'
      });
    }
  }
);

// Logs de validación
router.get('/analytics/validation-logs',
  AuthService.requireRole(['admin', 'staff']),
  [
    query('eventId').optional().isInt(),
    query('staffId').optional().isInt(),
    query('success').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId, staffId, success, limit = 100, offset = 0 } = req.query;

      let query = db.select({
        log: validationLogs,
        ticket: tickets,
        event: events,
        staffMember: staff
      })
      .from(validationLogs)
      .leftJoin(tickets, eq(validationLogs.ticketId, tickets.id))
      .leftJoin(events, eq(tickets.eventId, events.id))
      .leftJoin(staff, eq(validationLogs.staffId, staff.id));

      const conditions = [];
      if (eventId) conditions.push(eq(events.id, parseInt(eventId)));
      if (staffId) conditions.push(eq(validationLogs.staffId, parseInt(staffId)));
      if (success !== undefined) conditions.push(eq(validationLogs.success, success === 'true'));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const logs = await query
        .orderBy(desc(validationLogs.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      res.json({
        success: true,
        validationLogs: logs.map(({ log, ticket, event, staffMember }) => ({
          ...log,
          ticket: ticket ? {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            holderName: ticket.holderName
          } : null,
          event: event ? {
            id: event.id,
            name: event.name
          } : null,
          staff: staffMember ? {
            id: staffMember.id,
            name: staffMember.name,
            email: staffMember.email
          } : null
        }))
      });

    } catch (error) {
      console.error('Error obteniendo logs de validación:', error);
      res.status(500).json({
        success: false,
        error: 'VALIDATION_LOGS_ERROR',
        message: 'Error obteniendo logs de validación'
      });
    }
  }
);

/**
 * GESTIÓN DE USUARIOS
 */

// Listar usuarios de staff
router.get('/staff',
  AuthService.requireRole(['admin']),
  async (req, res) => {
    try {
      const staffList = await db.select({
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        permissions: staff.permissions,
        isActive: staff.isActive,
        lastLoginAt: staff.lastLoginAt,
        createdAt: staff.createdAt
      }).from(staff).orderBy(desc(staff.createdAt));

      res.json({
        success: true,
        staff: staffList.map(member => ({
          ...member,
          permissions: member.permissions ? JSON.parse(member.permissions) : []
        }))
      });

    } catch (error) {
      console.error('Error obteniendo staff:', error);
      res.status(500).json({
        success: false,
        error: 'STAFF_ERROR',
        message: 'Error obteniendo lista de staff'
      });
    }
  }
);

/**
 * TICKETS - Lista de tickets por evento (para sincronización offline)
 */
router.get('/events/:eventId/tickets',
  AuthService.requireRole(['admin', 'staff']),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { isUsed } = req.query;

      let conditions = [eq(tickets.eventId, parseInt(eventId))];
      if (isUsed !== undefined) {
        conditions.push(eq(tickets.isUsed, isUsed === 'true'));
      }

      const result = await db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          holderName: tickets.holderName,
          holderEmail: tickets.holderEmail,
          customerName: orders.customerName,
          customerEmail: orders.customerEmail,
          ticketTypeId: tickets.ticketTypeId,
          isUsed: tickets.isUsed,
          usedAt: tickets.usedAt,
          qrCode: tickets.qrCode,
        })
        .from(tickets)
        .innerJoin(orders, eq(tickets.orderId, orders.id))
        .where(and(...conditions));

      res.json({
        success: true,
        tickets: result,
        syncedAt: new Date().toISOString(),
        count: result.length
      });
    } catch (err) {
      console.error('Error fetching tickets:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
    }
  }
);

/**
 * INFORMACIÓN DEL PANEL DE ADMINISTRACIÓN
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'TriskelGate Admin Panel API',
    version: '1.0.0',
    description: 'Panel de administración para la plataforma de pago TriskelGate',
    endpoints: {
      dashboard: 'GET /admin/dashboard - Estadísticas generales',
      events: {
        list: 'GET /admin/events - Listar eventos',
        create: 'POST /admin/events - Crear evento'
      },
      ticketTypes: {
        list: 'GET /admin/ticket-types - Listar tipos de tickets',
        create: 'POST /admin/ticket-types - Crear tipo de ticket'
      },
      orders: {
        list: 'GET /admin/orders - Listar órdenes',
        details: 'GET /admin/orders/:id - Detalles de orden'
      },
      analytics: {
        sales: 'GET /admin/analytics/sales - Análisis de ventas',
        logs: 'GET /admin/analytics/validation-logs - Logs de validación'
      },
      staff: {
        list: 'GET /admin/staff - Listar staff'
      }
    },
    requiredRoles: ['admin', 'staff'],
    features: [
      '📊 Dashboard con estadísticas en tiempo real',
      '🎫 Gestión completa de eventos y tickets',
      '💰 Seguimiento de órdenes y pagos',
      '📈 Análisis de ventas detallado',
      '👥 Gestión de usuarios y permisos',
      '📋 Logs de validación completos',
      '🔒 Sistema de roles y permisos',
      '⚡ Rendimiento optimizado'
    ]
  });
});

// Manual trigger for no-show sync (also triggered automatically via cron in production)
router.post('/events/sync-no-shows',
  AuthService.requireRole(['admin']),
  async (req, res) => {
    try {
      const { processNoShows } = await import('../services/noShowSync.js');
      await processNoShows();
      res.json({ success: true, message: 'No-show sync completed' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Update event + HubSpot sync
router.put('/events/:id',
  AuthService.requireRole(['admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db
        .update(events)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(events.id, parseInt(id)))
        .returning();
      if (!updated.length) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

      if (req.body.status === 'cancelled') {
        cancelEvent(id).catch(() => {});
      } else {
        syncEvent(updated[0]).catch(() => {});
      }

      res.json({ success: true, event: updated[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error actualizando evento' });
    }
  }
);

export default router;
