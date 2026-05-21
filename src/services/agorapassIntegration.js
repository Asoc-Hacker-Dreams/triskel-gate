const axios = require('axios');
const logger = require('../utils/logger'); // ensure this exists, or use console.error

class AgoraPassIntegrationService {
  constructor() {
    this.agoraPassApiUrl = process.env.AGORAPASS_API_URL || 'http://localhost:8080/api/v1';
    this.apiKey = process.env.AGORAPASS_API_KEY || 'tg-dev-api-key';
  }

  /**
   * Pushes an event to AgoraPass to be listed on their platform
   * @param {Object} eventData The event object from Triskell Gate DB
   * @param {string} eventUrl The public URL to buy tickets
   */
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
        external_event_id: eventData.slug || eventData.id.toString(),
        external_event_url: eventUrl || `${process.env.MAIN_APP_URL}/events/${eventData.slug}`
      };

      const response = await axios.post(`${this.agoraPassApiUrl}/events/sync`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}` // or X-API-Key
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      // We don't want to crash the main ticket platform if AgoraPass is down, just log it.
      console.error('[AgoraPass Sync Error] Failed to sync event', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pushes a "Stamp Request" to AgoraPass when someone checks in at a Triskell Gate scanner and the event is integrated.
   * @param {string} email Attendee email
   * @param {string} eventName Event name for reference
   * @param {string} ticketPlatorm Event platform identifier
   */
  async issueStampForAttendee(email, eventName, ticketPlatform = 'triskell-gate') {
    try {
      const payload = {
        attendeeEmail: email,
        attendeeName: "Attendee", // Triskell Gate might not always force name, default it
        eventId: "mapped-or-dynamically-resolved", // In real flow, fetch mapped Agora ID or use external
        ticketPlatform: ticketPlatform
      };

      // POST to AgoraPass to issue stamp. If user isn't found on AP, AP's backend handles sending the physical email invite.
      const response = await axios.post(`${this.agoraPassApiUrl}/checkin/issue-stamp`, payload, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      return { success: true, data: response.data };
    } catch (error) {
       console.error('[AgoraPass Stamp Error] Failed to issue stamp', error.message);
       return { success: false, error: error.message };
    }
  }
}

module.exports = new AgoraPassIntegrationService();
