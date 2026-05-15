import https from 'https';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const BASE_URL = 'api.hubapi.com';

/**
 * Upsert a contact in HubSpot CRM. Non-blocking — never throws.
 *
 * @param {Object} props
 * @param {string} props.email
 * @param {string} [props.firstname]
 * @param {string} [props.lastname]
 * @param {boolean} [props.marketingConsent]
 * @param {boolean} [props.newsletterConsent]
 * @param {Date|string} [props.consentDate]
 * @param {Date|string} [props.memberSince]
 * @param {string} [props.eventName]
 * @param {string} [props.eventDate]
 * @param {string} [props.ticketTier] — general|vip|speaker|sponsor|startup_pack|press
 * @param {string|number} [props.triskelgateId]
 */
async function upsertContact(props) {
  if (!HUBSPOT_API_KEY) return;

  const properties = {
    email: props.email,
    ...(props.firstname && { firstname: props.firstname }),
    ...(props.lastname && { lastname: props.lastname }),
    xops_marketing_consent: String(!!props.marketingConsent),
    xops_newsletter_consent: String(!!props.newsletterConsent),
    xops_consent_date: props.consentDate
      ? new Date(props.consentDate).toISOString()
      : new Date().toISOString(),
    xops_source: 'triskelgate',
    xops_community_role: 'attendee',
    ...(props.memberSince && { xops_member_since: new Date(props.memberSince).toISOString() }),
    ...(props.eventName && { xops_last_event_name: props.eventName }),
    ...(props.eventDate && { xops_last_event_date: new Date(props.eventDate).toISOString() }),
    ...(props.ticketTier && { xops_ticket_tier: props.ticketTier.toLowerCase() }),
    ...(props.triskelgateId && { xops_triskelgate_id: String(props.triskelgateId) }),
  };

  const body = JSON.stringify({
    inputs: [{ idProperty: 'email', id: props.email, properties }],
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: BASE_URL,
        path: '/crm/v3/objects/contacts/batch/upsert',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            console.error('⚠️ HubSpot upsert failed:', res.statusCode, data);
          }
          resolve(undefined);
        });
      }
    );
    req.on('error', (err) => {
      console.error('⚠️ HubSpot request error (non-blocking):', err.message);
      resolve(undefined);
    });
    req.write(body);
    req.end();
  });
}

export { upsertContact };
