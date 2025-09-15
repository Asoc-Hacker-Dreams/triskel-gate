import { db } from '../db/connection.js';
import { tickets, events, ticketTypes, validationLogs } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export class TicketValidationService {

  /**
   * Valida un ticket por código QR
   */
  async validateTicket(qrCode, staffId = null, location = null, deviceInfo = null, ipAddress = null) {
    try {
      // Buscar el ticket por QR code
      const ticketResult = await db
        .select({
          ticket: tickets,
          event: events,
          ticketType: ticketTypes
        })
        .from(tickets)
        .innerJoin(events, eq(tickets.eventId, events.id))
        .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id))
        .where(eq(tickets.qrCode, qrCode))
        .limit(1);

      if (ticketResult.length === 0) {
        await this.logValidation(null, staffId, 'validate', location, deviceInfo, ipAddress, false, 'Ticket no encontrado');
        return {
          success: false,
          error: 'TICKET_NOT_FOUND',
          message: 'El código QR no corresponde a ningún ticket válido'
        };
      }

      const { ticket, event, ticketType } = ticketResult[0];

      // Verificar si el ticket ya fue usado
      if (ticket.isUsed) {
        await this.logValidation(ticket.id, staffId, 'validate', location, deviceInfo, ipAddress, false, 'Ticket ya utilizado');
        return {
          success: false,
          error: 'TICKET_ALREADY_USED',
          message: 'Este ticket ya ha sido utilizado',
          usedAt: ticket.usedAt,
          usedBy: ticket.usedBy
        };
      }

      // Verificar fechas del evento
      const now = new Date();
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);

      if (now < eventStart) {
        await this.logValidation(ticket.id, staffId, 'validate', location, deviceInfo, ipAddress, false, 'Evento aún no ha comenzado');
        return {
          success: false,
          error: 'EVENT_NOT_STARTED',
          message: 'El evento aún no ha comenzado',
          eventStartDate: event.startDate
        };
      }

      if (now > eventEnd) {
        await this.logValidation(ticket.id, staffId, 'validate', location, deviceInfo, ipAddress, false, 'Evento ya ha terminado');
        return {
          success: false,
          error: 'EVENT_ENDED',
          message: 'El evento ya ha terminado',
          eventEndDate: event.endDate
        };
      }

      // Marcar ticket como usado
      const updatedTicket = await db
        .update(tickets)
        .set({
          isUsed: true,
          usedAt: new Date().toISOString(),
          usedBy: staffId ? staffId.toString() : 'system',
          checkInLocation: location || 'entrance',
          updatedAt: new Date().toISOString()
        })
        .where(eq(tickets.id, ticket.id))
        .returning();

      await this.logValidation(ticket.id, staffId, 'validate', location, deviceInfo, ipAddress, true, 'Ticket validado correctamente');

      return {
        success: true,
        message: 'Ticket validado correctamente',
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          holderName: ticket.holderName || 'No especificado',
          holderEmail: ticket.holderEmail || ticket.holderEmail,
          price: ticket.price,
          validatedAt: updatedTicket[0].usedAt
        },
        event: {
          name: event.name,
          location: event.location,
          date: event.startDate
        },
        ticketType: {
          name: ticketType.name,
          description: ticketType.description
        }
      };

    } catch (error) {
      console.error('Error validando ticket:', error);
      await this.logValidation(null, staffId, 'validate', location, deviceInfo, ipAddress, false, `Error interno: ${error.message}`);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Error interno del sistema'
      };
    }
  }

  /**
   * Busca tickets por diferentes criterios
   */
  async searchTickets(criteria) {
    try {
      const {
        email,
        ticketNumber,
        uuid,
        qrCode,
        eventId,
        isUsed,
        // startDate,
        // endDate,
        limit = 50,
        offset = 0
      } = criteria;

      let query = db
        .select({
          ticket: tickets,
          event: events,
          ticketType: ticketTypes
        })
        .from(tickets)
        .innerJoin(events, eq(tickets.eventId, events.id))
        .innerJoin(ticketTypes, eq(tickets.ticketTypeId, ticketTypes.id));

      const conditions = [];

      if (email) {
        conditions.push(eq(tickets.holderEmail, email));
      }
      if (ticketNumber) {
        conditions.push(eq(tickets.ticketNumber, ticketNumber));
      }
      if (uuid) {
        conditions.push(eq(tickets.uuid, uuid));
      }
      if (qrCode) {
        conditions.push(eq(tickets.qrCode, qrCode));
      }
      if (eventId) {
        conditions.push(eq(tickets.eventId, eventId));
      }
      if (isUsed !== undefined) {
        conditions.push(eq(tickets.isUsed, isUsed));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        tickets: results.map(({ ticket, event, ticketType }) => ({
          id: ticket.id,
          uuid: ticket.uuid,
          ticketNumber: ticket.ticketNumber,
          qrCode: ticket.qrCode,
          holderName: ticket.holderName,
          holderEmail: ticket.holderEmail,
          price: ticket.price,
          isUsed: ticket.isUsed,
          usedAt: ticket.usedAt,
          usedBy: ticket.usedBy,
          checkInLocation: ticket.checkInLocation,
          createdAt: ticket.createdAt,
          event: {
            id: event.id,
            name: event.name,
            location: event.location,
            startDate: event.startDate,
            endDate: event.endDate
          },
          ticketType: {
            id: ticketType.id,
            name: ticketType.name,
            description: ticketType.description,
            price: ticketType.price
          }
        })),
        total: results.length
      };

    } catch (error) {
      console.error('Error buscando tickets:', error);
      return {
        success: false,
        error: 'SEARCH_ERROR',
        message: 'Error realizando la búsqueda'
      };
    }
  }

  /**
   * Obtiene estadísticas de validación
   */
  async getValidationStats(eventId = null) {
    try {
      let query = db
        .select({
          total: tickets.id,
          used: tickets.isUsed,
          eventId: tickets.eventId
        })
        .from(tickets);

      if (eventId) {
        query = query.where(eq(tickets.eventId, eventId));
      }

      const results = await query;

      const stats = {
        total: results.length,
        validated: results.filter(r => r.used).length,
        pending: results.filter(r => !r.used).length,
        validationRate: 0
      };

      if (stats.total > 0) {
        stats.validationRate = ((stats.validated / stats.total) * 100).toFixed(2);
      }

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        success: false,
        error: 'STATS_ERROR',
        message: 'Error obteniendo estadísticas'
      };
    }
  }

  /**
   * Registra un log de validación
   */
  async logValidation(ticketId, staffId, action, location, deviceInfo, ipAddress, success, errorMessage = null) {
    try {
      await db.insert(validationLogs).values({
        ticketId,
        staffId,
        action,
        location,
        deviceInfo,
        ipAddress,
        success,
        errorMessage,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error registrando log de validación:', error);
    }
  }

  /**
   * Invalida un ticket (marca como no usado)
   */
  async invalidateTicket(ticketId, staffId, reason = null) {
    try {
      const ticket = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);

      if (ticket.length === 0) {
        return {
          success: false,
          error: 'TICKET_NOT_FOUND',
          message: 'Ticket no encontrado'
        };
      }

      await db
        .update(tickets)
        .set({
          isUsed: false,
          usedAt: null,
          usedBy: null,
          checkInLocation: null,
          notes: reason,
          updatedAt: new Date().toISOString()
        })
        .where(eq(tickets.id, ticketId));

      await this.logValidation(ticketId, staffId, 'invalidate', null, null, null, true, reason);

      return {
        success: true,
        message: 'Ticket invalidado correctamente'
      };

    } catch (error) {
      console.error('Error invalidando ticket:', error);
      return {
        success: false,
        error: 'INVALIDATE_ERROR',
        message: 'Error invalidando ticket'
      };
    }
  }
}

export default new TicketValidationService();
