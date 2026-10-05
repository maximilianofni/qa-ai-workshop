import { test, expect } from '@playwright/test';

test('BD-SMOKE-01 | La app redirige al login del autenticador', async ({ page }) => {
  await page.goto('/');

  // Biblioteca Digital no tiene login propio: delega en el autenticador
  await expect(page).toHaveURL(/authenticator\..*\/Account\/Login/);
  await expect(page).toHaveTitle('UltraIP');
  await expect(page.locator('#Username')).toBeVisible();
  await expect(page.locator('#login-password-input')).toBeVisible();
  await expect(page.locator('button.login-button')).toBeVisible();
});
