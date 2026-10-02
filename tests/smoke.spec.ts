import { test, expect } from '@playwright/test';

test('SMOKE-01 | La página de login abre en Chrome', async ({ page }) => {
  await page.goto('login.php');

  await expect(page).toHaveTitle('Login - ANPR - UltraIP');
  await expect(page.locator('input[name="userName"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('button.login-submit')).toBeVisible();
});
