import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('FireVision IPTV')).toBeVisible();
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Sign In')).toBeVisible();
});

test('health endpoint responds', async ({ request }) => {
  const response = await request.get('http://localhost:3000/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBeDefined();
});
