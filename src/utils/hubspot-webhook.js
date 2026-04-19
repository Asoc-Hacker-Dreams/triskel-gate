/**
 * HubSpot Webhook Helper
 */

const HUBSPOT_SYNC_URL = process.env.HUBSPOT_SYNC_URL || 'http://localhost:3002';

async function sendHubSpotWebhook(event, payload) {
  if (process.env.HUBSPOT_SYNC_ENABLED !== 'true') {
    return null;
  }

  try {
    const response = await fetch(`${HUBSPOT_SYNC_URL}/webhooks/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    console.error('[HubSpot] Webhook failed:', error.message);
    return null;
  }
}

module.exports = { sendHubSpotWebhook };
