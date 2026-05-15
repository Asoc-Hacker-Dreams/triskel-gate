import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface TGOfflineDB extends DBSchema {
  tickets: {
    key: string;
    value: {
      ticketNumber: string;
      holderName: string;
      holderEmail: string;
      ticketTypeId: number;
      status: string;
      validatedAt?: string;
      syncedAt: string;
    };
    indexes: { 'by-status': string };
  };
  offlineValidations: {
    key: number;
    value: {
      qrCode: string;
      staffId: number;
      location: string;
      deviceInfo: string;
      validatedAt: string;
      synced: number; // 0 = unsynced, 1 = synced (IndexedDB can't index booleans)
    };
    indexes: { 'by-synced': number };
  };
  syncMeta: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbInstance: IDBPDatabase<TGOfflineDB> | null = null;

export async function getDb(): Promise<IDBPDatabase<TGOfflineDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<TGOfflineDB>('triskelgate-offline', 1, {
    upgrade(db) {
      const ticketStore = db.createObjectStore('tickets', { keyPath: 'ticketNumber' });
      ticketStore.createIndex('by-status', 'status');

      const validationStore = db.createObjectStore('offlineValidations', { autoIncrement: true });
      validationStore.createIndex('by-synced', 'synced');

      db.createObjectStore('syncMeta', { keyPath: 'key' });
    },
  });
  return dbInstance;
}

export async function storeTickets(tickets: TGOfflineDB['tickets']['value'][]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('tickets', 'readwrite');
  for (const t of tickets) {
    await tx.store.put(t);
  }
  await tx.done;
  const metaTx = db.transaction('syncMeta', 'readwrite');
  await metaTx.store.put({ key: 'lastSync', value: new Date().toISOString() });
  await metaTx.done;
}

export async function getTicket(ticketNumber: string): Promise<TGOfflineDB['tickets']['value'] | undefined> {
  const db = await getDb();
  return db.get('tickets', ticketNumber);
}

export async function markTicketValidated(ticketNumber: string): Promise<void> {
  const db = await getDb();
  const ticket = await db.get('tickets', ticketNumber);
  if (ticket) {
    ticket.status = 'validated_offline';
    ticket.validatedAt = new Date().toISOString();
    await db.put('tickets', ticket);
  }
}

export async function storeOfflineValidation(
  validation: Omit<TGOfflineDB['offlineValidations']['value'], 'synced'>
): Promise<void> {
  const db = await getDb();
  await db.add('offlineValidations', { ...validation, synced: 0 });
}

export async function getUnsyncedValidations(): Promise<TGOfflineDB['offlineValidations']['value'][]> {
  const db = await getDb();
  return db.getAllFromIndex('offlineValidations', 'by-synced', 0);
}

export async function markValidationsSynced(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('offlineValidations', 'readwrite');
  let cursor = await tx.store.index('by-synced').openCursor(0);
  while (cursor) {
    await cursor.update({ ...cursor.value, synced: 1 });
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getTicketCount(): Promise<{ total: number; validated: number }> {
  const db = await getDb();
  const all = await db.getAll('tickets');
  const validated = all.filter(t => t.status === 'used' || t.status === 'validated_offline');
  return { total: all.length, validated: validated.length };
}

export async function getLastSyncTime(): Promise<string | null> {
  const db = await getDb();
  const meta = await db.get('syncMeta', 'lastSync');
  return meta?.value ?? null;
}
