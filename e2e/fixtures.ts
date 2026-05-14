import { test as base } from '@playwright/test';

interface TriskelGateFixtures {
  apiUrl: string;
  staffToken: string;
}

export const test = base.extend<TriskelGateFixtures>({
  apiUrl: async ({}, use) => {
    await use(process.env.TG_API_URL ?? 'http://localhost:3001');
  },

  staffToken: async ({ apiUrl }, use) => {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'teststaff@hsm.dev',
        password: 'HsmStaff2026!',
      }),
    });

    if (!res.ok) {
      throw new Error(`Staff login failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.success || !data.token) {
      throw new Error(`Staff login response missing token: ${JSON.stringify(data)}`);
    }

    await use(data.token);
  },
});

export { expect } from '@playwright/test';
