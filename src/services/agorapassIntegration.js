class AgoraPassIntegrationService {
  constructor() {
    this.agoraPassApiUrl = process.env.AGORAPASS_API_URL || 'http://localhost:8080/api/v1';
    this.apiKey = process.env.AGORAPASS_API_KEY || 'tg-dev-api-key';
    this.timeoutMs = Number(process.env.AGORAPASS_TIMEOUT_MS || 10000);
  }

  async post(path, payload) {
    const response = await fetch(`${this.agoraPassApiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AgoraPass ${response.status}: ${text}`);
    }

    return response.json();
  }

  async syncEventToAgoraPass(eventData, eventUrl = '') {
    if (!eventData.isAgorapassIntegrated) {
      return { success: false, message: 'Event not configured for AgoraPass integration' };
    }

    try {
      const payload = {
        name: eventData.name,
        description: eventData.description || `${eventData.name} Tickets on Triskell Gate`,
        location: eventData.location,
        start_date: new Date(eventData.startDate).toISOString(),
        end_date: new Date(eventData.endDate).toISOString(),
        ticketing_platform: 'triskell-gate',
        external_event_id: eventData.slug || String(eventData.id),
        external_event_url: eventUrl || `${process.env.MAIN_APP_URL}/events/${eventData.slug}`
      };

      const data = await this.post('/events/sync', payload);
      return { success: true, data };
    } catch (error) {
      console.error('[AgoraPass Sync Error] Failed to sync event', error.message);
      return { success: false, error: error.message };
    }
  }

  async issueStampForAttendee(email, eventName, ticketPlatform = 'triskell-gate') {
    try {
      const payload = {
        attendeeEmail: email,
        attendeeName: 'Attendee',
        eventName,
        eventId: 'mapped-or-dynamically-resolved',
        ticketPlatform
      };

      const data = await this.post('/checkin/issue-stamp', payload);
      return { success: true, data };
    } catch (error) {
      console.error('[AgoraPass Stamp Error] Failed to issue stamp', error.message);
      return { success: false, error: error.message };
    }
  }
}

const agorapassIntegration = new AgoraPassIntegrationService();
export default agorapassIntegration;
