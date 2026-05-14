import { test, expect } from '../fixtures';

test.describe('Ticket Validation', () => {
  test.describe('POST /api/validate', () => {
    test('invalid ticket code returns error', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: 'INVALID-12345' }),
      });

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('TICKET_NOT_FOUND');
    });

    test('missing qrCode returns validation error', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  test.describe('GET /api/search', () => {
    test('search without auth returns 401', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/api/search?email=test@example.com`);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    test('search with auth returns results', async ({ apiUrl, staffToken }) => {
      const res = await fetch(`${apiUrl}/api/search?limit=5`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.tickets)).toBe(true);
    });
  });

  test.describe('GET /api/info', () => {
    test('returns API metadata', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/api/info`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.endpoints).toBeDefined();
    });
  });

  test.describe('GET /health', () => {
    test('returns healthy status', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/health`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.message).toBe('OK');
    });
  });
});
