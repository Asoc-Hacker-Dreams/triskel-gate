import https from 'https';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const BASE_URL = 'api.hubapi.com';

/**
 * Upsert a contact in HubSpot CRM via the batch upsert endpoint.
 * Only call this when marketing or newsletter consent is true.
 * Returns immediately if HUBSPOT_API_KEY is not configured.
 *
 * @param {Object} props - Contact properties
 * @param {string} props.email - Required
 * @param {string} [props.firstname]
 * @param {string} [props.lastname]
 * @param {boolean} [props.marketingConsent]
 * @param {boolean} [props.newsletterConsent]
 * @param {Date} [props.consentDate]
 * @param {Date} [props.memberSince]
 */
async function upsertContact(props) {
  if (!HUBSPOT_API_KEY) return; // not configured

  const properties = {
    email: props.email,
    ...(props.firstname && { firstname: props.firstname }),
    ...(props.lastname && { lastname: props.lastname }),
    xops_marketing_consent: String(!!props.marketingConsent),
    xops_newsletter_consent: String(!!props.newsletterConsent),
    xops_consent_date: (props.consentDate || new Date()).toISOString(),
    xops_source: 'triskelgate',
    ...(props.memberSince && { xops_member_since: props.memberSince.toISOString() }),
  };

  const body = JSON.stringify({
    inputs: [{ idProperty: 'email', id: props.email, properties }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: BASE_URL,
      path: '/crm/v3/objects/contacts/batch/upsert',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.error('⚠️ HubSpot upsert failed:', res.statusCode, data);
        }
        resolve();
      });
    });
    req.on('error', err => {
      console.error('⚠️ HubSpot request error (non-blocking):', err.message);
      resolve(); // non-blocking
    });
    req.write(body);
    req.end();
  });
}

export { upsertContact };
