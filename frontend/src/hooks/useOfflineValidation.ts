import { useCallback } from 'react';
import {
  getTicket, markTicketValidated, storeOfflineValidation,
  getUnsyncedValidations, markValidationsSynced,
} from '../lib/offlineDb';

const API_URL = import.meta.env.VITE_API_URL || '';

export function useOfflineValidation(token: string | null, staffId: number) {
  const validate = useCallback(async (qrCode: string) => {
    const isOnline = navigator.onLine;

    if (isOnline) {
      try {
        const res = await fetch(`${API_URL}/api/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ qrCode, staffId }),
        });
        const data = await res.json();
        if (data.success) {
          await markTicketValidated(qrCode);
        }
        return data;
      } catch {
        // Network error — fall through to offline validation
      }
    }

    const ticket = await getTicket(qrCode);
    if (!ticket) {
      return { success: false, error: 'TICKET_NOT_FOUND', message: 'Ticket no encontrado (offline)' };
    }
    if (ticket.status === 'used' || ticket.status === 'validated_offline') {
      return { success: false, error: 'TICKET_ALREADY_USED', message: 'Ticket ya utilizado' };
    }

    await markTicketValidated(qrCode);
    await storeOfflineValidation({
      qrCode,
      staffId,
      location: 'offline',
      deviceInfo: navigator.userAgent,
      validatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      offline: true,
      message: 'Validado offline',
      ticket: { ticketNumber: ticket.ticketNumber, holderName: ticket.holderName },
    };
  }, [token, staffId]);

  const syncOfflineValidations = useCallback(async () => {
    if (!navigator.onLine || !token) return 0;
    const unsynced = await getUnsyncedValidations();
    if (unsynced.length === 0) return 0;

    try {
      const res = await fetch(`${API_URL}/api/validate/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ validations: unsynced }),
      });
      if (res.ok) {
        await markValidationsSynced();
        return unsynced.length;
      }
    } catch (err) {
      console.error('Batch sync failed:', err);
    }
    return 0;
  }, [token]);

  return { validate, syncOfflineValidations };
}
