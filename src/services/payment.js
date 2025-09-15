import Stripe from 'stripe';
import { db } from '../db/connection.js';
import { orders, tickets, events, ticketTypes, salesStats } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

export class PaymentService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2020-08-27'
    });
  }

  /**
   * Crea una sesión de pago con Stripe
   */
  async createPaymentSession(orderData) {
    try {
      const {
        eventId,
        ticketTypeId,
        quantity,
        customerEmail,
        customerName,
        customerPhone,
        successUrl,
        cancelUrl,
        metadata = {}
      } = orderData;

      // Validar que el evento y tipo de ticket existan
      const ticketTypeResult = await db
        .select({
          ticketType: ticketTypes,
          event: events
        })
        .from(ticketTypes)
        .innerJoin(events, eq(ticketTypes.eventId, events.id))
        .where(and(
          eq(ticketTypes.id, ticketTypeId),
          eq(events.id, eventId),
          eq(ticketTypes.isActive, true),
          eq(events.status, 'active')
        ))
        .limit(1);

      if (ticketTypeResult.length === 0) {
        return {
          success: false,
          error: 'INVALID_TICKET_TYPE',
          message: 'Tipo de ticket o evento no válido'
        };
      }

      const { ticketType, event } = ticketTypeResult[0];

      // Verificar fechas de venta
      const now = new Date();
      const saleStart = new Date(ticketType.saleStartDate);
      const saleEnd = new Date(ticketType.saleEndDate);

      if (now < saleStart) {
        return {
          success: false,
          error: 'SALE_NOT_STARTED',
          message: 'La venta de tickets aún no ha comenzado'
        };
      }

      if (now > saleEnd) {
        return {
          success: false,
          error: 'SALE_ENDED',
          message: 'La venta de tickets ha terminado'
        };
      }

      // Verificar disponibilidad
      if (quantity > ticketType.maxQuantity) {
        return {
          success: false,
          error: 'QUANTITY_EXCEEDED',
          message: `Cantidad máxima permitida: ${ticketType.maxQuantity}`
        };
      }

      // Generar número de orden único
      const orderNumber = this.generateOrderNumber();
      const totalAmount = ticketType.price * quantity;

      // Crear orden pendiente en la base de datos
      const newOrder = await db
        .insert(orders)
        .values({
          orderNumber,
          eventId,
          customerEmail,
          customerName,
          customerPhone,
          totalAmount,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning();

      // Crear sesión de Stripe
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `${event.name} - ${ticketType.name}`,
                description: ticketType.description,
                images: metadata.images || []
              },
              unit_amount: Math.round(ticketType.price * 100) // Convertir a centavos
            },
            quantity: quantity
          }
        ],
        mode: 'payment',
        customer_email: customerEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orderId: newOrder[0].id.toString(),
          orderNumber: orderNumber,
          eventId: eventId.toString(),
          ticketTypeId: ticketTypeId.toString(),
          quantity: quantity.toString(),
          ...metadata
        },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutos
      });

      // Actualizar orden con ID de sesión de Stripe
      await db
        .update(orders)
        .set({
          stripeSessionId: session.id,
          updatedAt: new Date().toISOString()
        })
        .where(eq(orders.id, newOrder[0].id));

      return {
        success: true,
        sessionId: session.id,
        sessionUrl: session.url,
        orderId: newOrder[0].id,
        orderNumber: orderNumber,
        totalAmount: totalAmount
      };

    } catch (error) {
      console.error('Error creando sesión de pago:', error);
      return {
        success: false,
        error: 'PAYMENT_SESSION_ERROR',
        message: 'Error creando sesión de pago'
      };
    }
  }

  /**
   * Procesa el webhook de Stripe cuando el pago es exitoso
   */
  async processSuccessfulPayment(sessionData) {
    try {
      const { metadata } = sessionData;
      const orderId = parseInt(metadata.orderId);
      const eventId = parseInt(metadata.eventId);
      const ticketTypeId = parseInt(metadata.ticketTypeId);
      const quantity = parseInt(metadata.quantity);

      // Obtener orden
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (order.length === 0) {
        throw new Error('Orden no encontrada');
      }

      // Actualizar orden como completada
      await db
        .update(orders)
        .set({
          status: 'completed',
          stripePaymentIntentId: sessionData.payment_intent,
          updatedAt: new Date().toISOString()
        })
        .where(eq(orders.id, orderId));

      // Generar tickets
      const ticketPromises = [];
      for (let i = 0; i < quantity; i++) {
        const ticketData = await this.generateTicketData(orderId, eventId, ticketTypeId, order[0]);
        ticketPromises.push(
          db.insert(tickets).values(ticketData)
        );
      }

      await Promise.all(ticketPromises);

      // Actualizar estadísticas de ventas
      await this.updateSalesStats(eventId, quantity, order[0].totalAmount);

      // Obtener tickets creados para generar PDF
      const createdTickets = await db
        .select()
        .from(tickets)
        .where(eq(tickets.orderId, orderId));

      return {
        success: true,
        orderId: orderId,
        tickets: createdTickets,
        order: order[0]
      };

    } catch (error) {
      console.error('Error procesando pago exitoso:', error);
      throw error;
    }
  }

  /**
   * Genera datos para un ticket individual
   */
  async generateTicketData(orderId, eventId, ticketTypeId, order) {
    const uuid = uuidv4();
    const ticketNumber = this.generateTicketNumber();
    const qrCode = this.generateQRCode(uuid, ticketNumber);

    // Obtener información del tipo de ticket
    const ticketType = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, ticketTypeId))
      .limit(1);

    return {
      uuid,
      orderId,
      ticketTypeId,
      eventId,
      qrCode,
      ticketNumber,
      holderName: order.customerName,
      holderEmail: order.customerEmail,
      price: ticketType[0].price,
      isUsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Genera PDF con los tickets
   */
  async generateTicketsPDF(tickets, eventData, _orderData) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        autoFirstPage: false
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      (async () => {
        try {
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            doc.addPage();

            // Generar QR code
            const qrCodeBuffer = await QRCode.toBuffer(ticket.qrCode, {
              errorCorrectionLevel: 'H',
              margin: 1,
              width: 180
            });

            const ticketWidth = 400;
            const ticketX = (doc.page.width - ticketWidth) / 2;
            const ticketY = 50;

            doc.save();

            // Logo (si existe)
            try {
              doc.image(
                'static/images/hack-bcn.png',
                ticketX + (ticketWidth - 120) / 2,
                ticketY,
                { width: 120 }
              );
            } catch (e) {
              // Si no hay logo, continuar sin él
            }

            // Título del evento
            doc.fontSize(32).fillColor('#000000').font('Helvetica-Bold');
            doc.text(eventData.name, ticketX, ticketY + 140, {
              align: 'center',
              width: ticketWidth
            });

            // Información del evento
            doc.fontSize(16).fillColor('#000000');
            doc.text('Fecha:', ticketX, ticketY + 200);
            doc.text(new Date(eventData.startDate).toLocaleDateString('es-ES'), ticketX, ticketY + 220);

            doc.text('Ubicación:', ticketX + 200, ticketY + 200);
            doc.text(eventData.location, ticketX + 200, ticketY + 220);

            // Número de ticket
            doc.fontSize(16).text('Ticket #:', ticketX + 150, ticketY + 280);
            doc.fontSize(18).text(ticket.ticketNumber, ticketX + 150, ticketY + 300);

            // Precio
            doc.fillColor('#991B1B')
              .rect(ticketX + 150, ticketY + 350, 100, 50)
              .fill();
            doc.fillColor('#ffffff')
              .fontSize(18)
              .text(`${ticket.price}€`, ticketX + 150, ticketY + 365, {
                align: 'center',
                width: 100
              });

            // QR Code
            doc.image(qrCodeBuffer, ticketX + (ticketWidth - 180) / 2, ticketY + 420, {
              width: 180,
              height: 180
            });

            // Información adicional
            doc.fillColor('#000000')
              .fontSize(12)
              .text(`Titular: ${ticket.holderName}`, ticketX, ticketY + 620);
            doc.text(`Email: ${ticket.holderEmail}`, ticketX, ticketY + 635);
            doc.text(`UUID: ${ticket.uuid}`, ticketX, ticketY + 650);

            doc.restore();
          }
          doc.end();
        } catch (error) {
          reject(error);
        }
      })();
    });
  }

  /**
   * Actualiza estadísticas de ventas
   */
  async updateSalesStats(eventId, quantity, revenue) {
    const today = new Date().toISOString().split('T')[0];

    try {
      // Verificar si ya existe un registro para hoy
      const existingStats = await db
        .select()
        .from(salesStats)
        .where(and(
          eq(salesStats.eventId, eventId),
          eq(salesStats.date, today)
        ))
        .limit(1);

      if (existingStats.length > 0) {
        // Actualizar estadísticas existentes
        await db
          .update(salesStats)
          .set({
            ticketsSold: existingStats[0].ticketsSold + quantity,
            revenue: existingStats[0].revenue + revenue
          })
          .where(eq(salesStats.id, existingStats[0].id));
      } else {
        // Crear nuevo registro de estadísticas
        await db
          .insert(salesStats)
          .values({
            eventId,
            date: today,
            ticketsSold: quantity,
            revenue: revenue,
            refunds: 0,
            createdAt: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error actualizando estadísticas de ventas:', error);
    }
  }

  /**
   * Genera número de orden único
   */
  generateOrderNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `HBC-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Genera número de ticket único
   */
  generateTicketNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 3);
    return `T-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Genera código QR único
   */
  generateQRCode(uuid, ticketNumber) {
    const data = {
      uuid,
      ticketNumber,
      timestamp: Date.now(),
      signature: crypto.createHash('sha256').update(`${uuid}-${ticketNumber}-${process.env.QR_SECRET}`).digest('hex').substr(0, 8)
    };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Procesa reembolsos
   */
  async processRefund(orderId, reason = null) {
    try {
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (order.length === 0) {
        return {
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: 'Orden no encontrada'
        };
      }

      if (order[0].status !== 'completed') {
        return {
          success: false,
          error: 'INVALID_ORDER_STATUS',
          message: 'Solo se pueden reembolsar órdenes completadas'
        };
      }

      // Procesar reembolso en Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: order[0].stripePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          orderId: orderId.toString(),
          reason: reason || 'Customer request'
        }
      });

      // Actualizar orden
      await db
        .update(orders)
        .set({
          status: 'refunded',
          notes: reason,
          updatedAt: new Date().toISOString()
        })
        .where(eq(orders.id, orderId));

      // Invalidar tickets
      await db
        .update(tickets)
        .set({
          isUsed: true, // Marcar como usado para que no se puedan usar
          notes: 'Refunded',
          updatedAt: new Date().toISOString()
        })
        .where(eq(tickets.orderId, orderId));

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100
      };

    } catch (error) {
      console.error('Error procesando reembolso:', error);
      return {
        success: false,
        error: 'REFUND_ERROR',
        message: 'Error procesando reembolso'
      };
    }
  }
}

export default new PaymentService();
