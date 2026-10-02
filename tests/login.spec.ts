import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('login.php');
  await page.locator('input[name="userName"]').fill(process.env.APP_USER!);
  await page.locator('input[name="password"]').fill(process.env.APP_PASSWORD!);
  await page.locator('button.login-submit').click();
}

test('LOGIN-01 | Login exitoso con usuario válido', async ({ page }) => {
  await login(page);

  await expect(page).toHaveURL(/index\.php/);
  await expect(page).toHaveTitle('Panel de control - ANPR - UltraIP');
  await expect(page.getByText(process.env.APP_USER!, { exact: true })).toBeVisible();

  // Pausa de 2 segundos para ver el Panel de control
  await page.waitForTimeout(2000);
});

test('LOGIN-02 | Login con contraseña incorrecta', async ({ page }) => {
  await page.goto('login.php');

  // Contraseña distinta a la válida del .env
  await page.locator('input[name="userName"]').fill(process.env.APP_USER!);
  await page.locator('input[name="password"]').fill(`${process.env.APP_PASSWORD}-incorrecta`);
  await page.locator('button.login-submit').click();

  await expect(page.locator('#loginError')).toHaveText(
    'Cuenta de usuario inválida. Verifique su usuario y/o contraseña.'
  );
  await expect(page).toHaveURL(/login\.php/);
  await expect(page).toHaveTitle('Login - ANPR - UltraIP');

  // Sin sesión iniciada, no se puede entrar al Panel de control
  await page.goto('index.php');
  await expect(page).toHaveURL(/login\.php/);
});

test('LOGIN-03 | Login con campos vacíos', async ({ page }) => {
  await page.goto('login.php');

  // Click en Login sin completar usuario ni contraseña
  await page.locator('button.login-submit').click();

  await expect(page.locator('#loginError')).toHaveText('Debe ingresar usuario y contraseña.');
  await expect(page).toHaveURL(/login\.php/);
  await expect(page).toHaveTitle('Login - ANPR - UltraIP');
});

test('LOGOUT-01 | Cerrar sesión vuelve al login', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/index\.php/);

  // Pausa de 2 segundos para ver el Panel de control
  await page.waitForTimeout(2000);

  // Abrir el menú del usuario y hacer click en Logout
  await page.locator('a.user').click();
  await page.locator('a.logout').click();

  await expect(page).toHaveURL(/login\.php/);
  await expect(page).toHaveTitle('Login - ANPR - UltraIP');

  // Con la sesión cerrada, no se puede entrar al Panel de control
  await page.goto('index.php');
  await expect(page).toHaveURL(/login\.php/);
});
