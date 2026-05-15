// Run after events end to mark non-attendees as NO_SHOW in HubSpot
// Call processNoShows() from a cron job or manually via admin API

import { db } from '../db/connection.js';
import { tickets, events } from '../db/schema.js';
import { eq, and, lt, gte } from 'drizzle-orm';
import { markNoShows } from './hubspotEvents.js';

/**
 * For all events that ended in the last 24h, find registered but not checked-in tickets
 * and mark them as NO_SHOW in HubSpot.
 */
export async function processNoShows() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Events that ended in the last 24h
  const endedEvents = await db
    .select()
    .from(events)
    .where(
      and(
        lt(events.endDate, now),
        gte(events.endDate, yesterday)
      )
    );

  for (const event of endedEvents) {
    // Find tickets that were purchased but NOT used (no check-in)
    const noShowTickets = await db
      .select({ holderEmail: tickets.holderEmail })
      .from(tickets)
      .where(
        and(
          eq(tickets.eventId, event.id),
          eq(tickets.isUsed, false)
        )
      );

    if (noShowTickets.length > 0) {
      console.log(`[noShowSync] Event "${event.name}": ${noShowTickets.length} no-shows`);
      await markNoShows({
        eventId: event.id,
        contacts: noShowTickets.map(t => ({ email: t.holderEmail })),
      });
    }
  }
}
