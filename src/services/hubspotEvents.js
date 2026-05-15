import https from 'https';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_APP_ID = process.env.HUBSPOT_PORTAL_ID || '146440838';
const EXTERNAL_ACCOUNT_ID = 'triskelgate';
const BASE_URL = 'api.hubapi.com';

function hubspotRequest(method, path, body) {
  return new Promise((resolve) => {
    if (!HUBSPOT_API_KEY) return resolve(null);
    const payload = body ? JSON.stringify(body) : '';
    const req = https.request(
      {
        hostname: BASE_URL,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            console.error(`⚠️ HubSpot Marketing Events error [${method} ${path}]:`, res.statusCode, data.slice(0, 200));
          }
          resolve(data);
        });
      }
    );
    req.on('error', (e) => {
      console.error('⚠️ HubSpot Marketing Events request error:', e.message);
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Create or update a Marketing Event in HubSpot from a TriskelGate event.
 * Call this when an event is created or updated.
 */
async function syncEvent(event) {
  if (!HUBSPOT_API_KEY) return;
  const externalEventId = `tg-${event.id}`;
  const statusMap = {
    active: 'SCHEDULED',
    live: 'LIVE',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
    draft: 'SCHEDULED',
  };

  const body = {
    externalAccountId: EXTERNAL_ACCOUNT_ID,
    externalEventId,
    eventName: event.name,
    eventOrganizer: 'X-Ops Alliance',
    startDateTime: new Date(event.startDate).toISOString(),
    endDateTime: new Date(event.endDate).toISOString(),
    eventStatus: statusMap[event.status?.toLowerCase()] || 'SCHEDULED',
    ...(event.description && { eventDescription: event.description }),
    ...(event.location && { customProperties: [{ name: 'location', value: event.location }] }),
  };

  await hubspotRequest(
    'PUT',
    `/marketing/v3/marketing-events/${HUBSPOT_APP_ID}/${externalEventId}`,
    body
  );
}

/**
 * Register a contact as REGISTERED for a TriskelGate event.
 * Call this when a ticket is purchased.
 */
async function registerAttendee({ eventId, email, firstname, lastname }) {
  if (!HUBSPOT_API_KEY || !email) return;
  const externalEventId = `tg-${eventId}`;
  await hubspotRequest(
    'POST',
    `/marketing/v3/marketing-events/${externalEventId}/subscribers/upsert`,
    {
      inputs: [{
        properties: [
          { name: 'email', value: email },
          ...(firstname ? [{ name: 'firstname', value: firstname }] : []),
          ...(lastname ? [{ name: 'lastname', value: lastname }] : []),
        ],
        subscriptionState: 'REGISTERED',
        interactionDateTime: Date.now(),
      }],
    }
  );
}

/**
 * Mark a contact as ATTENDED for a TriskelGate event.
 * Call this on successful check-in.
 */
async function markAttended({ eventId, email, firstname, lastname }) {
  if (!HUBSPOT_API_KEY || !email) return;
  const externalEventId = `tg-${eventId}`;
  await hubspotRequest(
    'POST',
    `/marketing/v3/marketing-events/${externalEventId}/attendances/upsert`,
    {
      inputs: [{
        properties: [
          { name: 'email', value: email },
          ...(firstname ? [{ name: 'firstname', value: firstname }] : []),
          ...(lastname ? [{ name: 'lastname', value: lastname }] : []),
        ],
        state: 'ATTENDED',
        interactionDateTime: Date.now(),
      }],
    }
  );
}

/**
 * Mark contacts as NO_SHOW for an event (run after event ends).
 * Pass an array of { email } objects for contacts who registered but didn't attend.
 */
async function markNoShows({ eventId, contacts }) {
  if (!HUBSPOT_API_KEY || !contacts?.length) return;
  const externalEventId = `tg-${eventId}`;
  const inputs = contacts.map((c) => ({
    properties: [{ name: 'email', value: c.email }],
    state: 'NO_SHOW',
    interactionDateTime: Date.now(),
  }));
  // Process in batches of 100 (HubSpot limit)
  for (let i = 0; i < inputs.length; i += 100) {
    await hubspotRequest(
      'POST',
      `/marketing/v3/marketing-events/${externalEventId}/attendances/upsert`,
      { inputs: inputs.slice(i, i + 100) }
    );
  }
}

/**
 * Cancel a Marketing Event in HubSpot.
 * Call this when an event is cancelled in TriskelGate.
 */
async function cancelEvent(eventId) {
  if (!HUBSPOT_API_KEY) return;
  const externalEventId = `tg-${eventId}`;
  await hubspotRequest(
    'PATCH',
    `/marketing/v3/marketing-events/${externalEventId}`,
    { eventStatus: 'CANCELLED' }
  );
}

export { syncEvent, registerAttendee, markAttended, markNoShows, cancelEvent };
