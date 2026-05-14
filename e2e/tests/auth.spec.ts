import { test, expect } from '../fixtures';

test.describe('Auth', () => {
  test.describe('Login page', () => {
    test('renders login page with branding and sign-in options', async ({ page }) => {
      await page.goto('/login');

      // Branding
      await expect(page.locator('h1')).toContainText('Triskell Gate');
      await expect(page.locator('h2')).toContainText('Welcome back');

      // Sign-in providers
      await expect(page.getByText('Sign in with Passkey')).toBeVisible();
      await expect(page.getByText('Google')).toBeVisible();
      await expect(page.getByText('Apple')).toBeVisible();
      await expect(page.getByText('Microsoft')).toBeVisible();
    });

    test('shows "or continue with" divider', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByText('or continue with')).toBeVisible();
    });

    test('shows terms footer note', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByText('Terms of Service')).toBeVisible();
    });
  });

  test.describe('Protected routes', () => {
    test('redirects unauthenticated user from /dashboard to /login', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForURL('**/login');
      await expect(page).toHaveURL(/\/login/);
    });

    test('redirects unauthenticated user from /events to /login', async ({ page }) => {
      await page.goto('/events');
      await page.waitForURL('**/login');
      await expect(page).toHaveURL(/\/login/);
    });

    test('redirects unauthenticated user from / to /login', async ({ page }) => {
      await page.goto('/');
      await page.waitForURL('**/login');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('API auth endpoint', () => {
    test('POST /auth/login with valid credentials returns token', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'teststaff@hsm.dev',
          password: 'HsmStaff2026!',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('teststaff@hsm.dev');
    });

    test('POST /auth/login with invalid credentials returns 401', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'teststaff@hsm.dev',
          password: 'WrongPassword123!',
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    test('POST /auth/login with missing fields returns 400', async ({ apiUrl }) => {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'teststaff@hsm.dev' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});
