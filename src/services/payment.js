import Stripe from 'stripe';
import { db, pool } from '../db/connection.js';
import { orders, tickets, events, ticketTypes, salesStats } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { upsertContact } from './hubspot.js';

export class PaymentService {
  constructor() {
    this.testMode = process.env.PAYMENT_TEST_MODE === 'true';
    this.skipSaleWindowCheck = process.env.SKIP_SALE_WINDOW_CHECK === 'true';

    if (!this.testMode) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2020-08-27',
      });
    } else {
      this.stripe = null;
    }
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

      if (!this.skipSaleWindowCheck) {
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
      
      // Calculate fees
      const subtotal = ticketType.price * quantity;
      const platformFeePercent = event.platformFeePercent || 3.0;
      const platformFee = Math.round(subtotal * (platformFeePercent / 100) * 100) / 100;
      const stripeFee = Math.round((subtotal * 0.029 + quantity * 0.25) * 100) / 100;
      const totalAmount = Math.round((subtotal + platformFee + stripeFee) * 100) / 100;

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
          subtotal,
          platformFee,
          stripeFee,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Crear sesión de Stripe (o mock en modo prueba)
      let session;

      if (this.testMode) {
        session = {
          id: `test_session_${newOrder[0].id}`,
          url: `${successUrl}?testMode=true&orderId=${newOrder[0].id}`
        };
      } else {
        session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: `${event.name} - ${ticketType.name}`,
                  description: ticketType.description,
                  images: metadata.images || [],
                },
                unit_amount: Math.round(ticketType.price * 100), // Convertir a centavos
              },
              quantity: quantity,
            },
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
          expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutos
        });
      }

      // Actualizar orden con ID de sesión
      await db
        .update(orders)
        .set({
          stripeSessionId: session.id,
          updatedAt: new Date()
        })
        .where(eq(orders.id, newOrder[0].id));

      return {
        success: true,
        sessionId: session.id,
        sessionUrl: session.url,
        orderId: newOrder[0].id,
        orderNumber: orderNumber,
        totalAmount: totalAmount,
          subtotal,
          platformFee,
          stripeFee,
        mode: this.testMode ? 'test' : 'live'
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
          updatedAt: new Date()
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

      const ticketResults = await Promise.all(ticketPromises);

      // Actualizar estadísticas de ventas
      await this.updateSalesStats(eventId, quantity, order[0].totalAmount);

      // Obtener tickets creados para generar PDF
      const createdTickets = await db
        .select()
        .from(tickets)
        .where(eq(tickets.orderId, orderId));

      // Fire-and-forget: sync tickets to AgoraPass (non-blocking)
      this.syncTicketsToAgoraPass(createdTickets, order[0], eventId, ticketTypeId)
        .catch(err => console.error('⚠️ AgoraPass batch sync error:', err.message));

      // Record GDPR consent choices from Stripe session metadata
      const newsletterConsent = sessionData.metadata?.newsletter_consent === 'true';
      const marketingConsent = sessionData.metadata?.marketing_consent === 'true';
      const holderEmail = sessionData.metadata?.buyer_email || sessionData.customer_details?.email;

      if (holderEmail) {
        // ip_address and user_agent passed via Stripe session metadata from checkout form
        const ipAddress = sessionData.metadata?.ip_address || null;
        const userAgent = sessionData.metadata?.user_agent || null;
        const consentTypes = [
          { type: 'essential', granted: true },
          { type: 'newsletters', granted: newsletterConsent },
          { type: 'marketing', granted: marketingConsent },
        ];
        for (const { type, granted } of consentTypes) {
          try {
            await pool.query(
              `INSERT INTO user_consents (email, consent_type, granted, granted_at, ip_address, user_agent, method)
               VALUES ($1, $2, $3, $4, $5, $6, 'signup')
               ON CONFLICT (user_id, consent_type) WHERE user_id IS NOT NULL DO NOTHING`,
              [holderEmail, type, granted, granted ? new Date() : null, ipAddress, userAgent]
            );
          } catch (err) {
            console.error('⚠️ Consent record error (non-blocking):', err.message);
          }
        }

        // Sync to HubSpot if marketing or newsletter opted in
        if (newsletterConsent || marketingConsent) {
          upsertContact({
            email: holderEmail,
            marketingConsent,
            newsletterConsent,
            consentDate: new Date(),
          }).catch(err => console.error('⚠️ HubSpot sync error (non-blocking):', err.message));
        }
      }

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
   * Syncs created tickets to AgoraPass (fire-and-forget)
   */
  async syncTicketsToAgoraPass(createdTickets, order, eventId, ticketTypeId) {
    const AGORAPASS_API = process.env.AGORAPASS_API_URL || 'http://localhost:8080';

    const event = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    const ticketType = await db.select().from(ticketTypes).where(eq(ticketTypes.id, ticketTypeId)).limit(1);

    for (const ticket of createdTickets) {
      try {
        const response = await fetch(`${AGORAPASS_API}/api/v1/tickets/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_id: `tg-${ticket.id}`,
            event_name: event[0]?.name || 'Unknown Event',
            event_date: event[0]?.startDate || null,
            event_location: event[0]?.location || '',
            ticket_type: ticketType[0]?.name || 'General',
            ticket_number: ticket.ticketNumber,
            qr_code: ticket.qrCode || ticket.ticketNumber,
            holder_email: order.customerEmail,
            holder_name: order.customerName,
            price: ticket.price || 0,
            currency: event[0]?.currency || 'USD',
            status: 'valid'
          })
        });
        if (response.ok) {
          console.log(`✅ Ticket ${ticket.ticketNumber} synced to AgoraPass`);
        } else {
          console.error(`⚠️ AgoraPass sync failed for ${ticket.ticketNumber}: ${response.status}`);
        }
      } catch (err) {
        console.error('⚠️ AgoraPass sync error (non-blocking):', err.message);
      }
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
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Genera PDF con los tickets
   */
  async generateTicketsPDF(tickets, eventData, orderData) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        autoFirstPage: false,
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
              width: 180,
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
              width: ticketWidth,
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
                width: 100,
              });

            // QR Code
            doc.image(qrCodeBuffer, ticketX + (ticketWidth - 180) / 2, ticketY + 420, {
              width: 180,
              height: 180,
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
    const today = new Date();
    
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
            createdAt: new Date()
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
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId));

      // Invalidar tickets
      await db
        .update(tickets)
        .set({
          isUsed: true, // Marcar como usado para que no se puedan usar
          notes: 'Refunded',
          updatedAt: new Date()
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
