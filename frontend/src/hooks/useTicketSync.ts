import { useState, useCallback } from 'react';
import { storeTickets, getTicketCount, getLastSyncTime } from '../lib/offlineDb';

const API_URL = import.meta.env.VITE_API_URL || '';

export function useTicketSync(token: string | null) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    count: number; validated: number; lastSync: string | null;
  }>({ count: 0, validated: 0, lastSync: null });

  const syncTickets = useCallback(async (eventId: number) => {
    if (!token) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/admin/events/${eventId}/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        await storeTickets(data.tickets.map((t: Record<string, unknown>) => ({
          ticketNumber: t.ticketNumber || t.qrCode,
          holderName: t.holderName || '',
          holderEmail: t.holderEmail || '',
          ticketTypeId: t.ticketTypeId || 0,
          status: t.isUsed ? 'used' : 'valid',
          validatedAt: t.usedAt || undefined,
          syncedAt: data.syncedAt,
        })));
      }
      const counts = await getTicketCount();
      const lastSync = await getLastSyncTime();
      setSyncStatus({ count: counts.total, validated: counts.validated, lastSync });
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [token]);

  const refreshStatus = useCallback(async () => {
    const counts = await getTicketCount();
    const lastSync = await getLastSyncTime();
    setSyncStatus({ count: counts.total, validated: counts.validated, lastSync });
  }, []);

  return { syncing, syncStatus, syncTickets, refreshStatus };
}
