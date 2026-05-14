import { test, expect } from '../fixtures';

test.describe('Events', () => {
  test.describe('Public API', () => {
    test('GET /api/events returns events list', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/api/events`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.count).toBeGreaterThanOrEqual(0);
    });

    test('GET /api/events contains seeded event', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/api/events`);
      const data = await res.json();

      expect(data.data.length).toBeGreaterThan(0);
      const eventNames = data.data.map((e: any) => e.name);
      expect(eventNames.some((n: string) => n.includes('Dubai') || n.includes('X-Ops'))).toBe(true);
    });

    test('GET /api/events/:id returns event details', async ({ apiUrl }) => {
      // First get events list to grab a valid ID
      const listRes = await fetch(`${apiUrl}/api/events`);
      const listData = await listRes.json();
      expect(listData.data.length).toBeGreaterThan(0);

      const eventId = listData.data[0].id;
      const res = await fetch(`${apiUrl}/api/events/${eventId}`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBe(eventId);
    });

    test('GET /api/events/:id with invalid ID returns 404', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/api/events/999999`);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('EVENT_NOT_FOUND');
    });
  });

  test.describe('Dashboard (authenticated)', () => {
    test('GET /admin/dashboard returns dashboard data with valid token', async ({ apiUrl, staffToken }) => {
      const res = await fetch(`${apiUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dashboard).toBeDefined();
      expect(data.dashboard.overview).toBeDefined();
    });

    test('GET /admin/dashboard without auth returns 401', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/admin/dashboard`);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
