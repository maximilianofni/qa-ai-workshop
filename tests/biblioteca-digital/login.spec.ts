import { test, expect, Page } from '@playwright/test';

const LOGIN = /authenticator\..*\/Account\/Login/;

async function login(page: Page, password = process.env.BD_PASSWORD!) {
  await page.goto('/');
  await page.locator('#Username').fill(process.env.BD_USER!);
  await page.locator('#login-password-input').fill(password);
  await page.locator('button.login-button').click();
}

test('BD-LOGIN-01 | Login exitoso con usuario válido', async ({ page }) => {
  await login(page);

  await expect(page).toHaveURL(process.env.BD_BASE_URL!);
  await expect(page).toHaveTitle('Biblioteca digital');
  await expect(page.locator('p.username')).toHaveText(process.env.BD_USER!);

  // Pausa de 2 segundos para ver la pantalla de Proyectos
  await page.waitForTimeout(2000);
});

test('BD-LOGIN-02 | Login con contraseña incorrecta', async ({ page }) => {
  // Contraseña distinta a la válida del .env
  await login(page, `${process.env.BD_PASSWORD}-incorrecta`);

  // Alerta con el título "Error" y el mensaje de credenciales inválidas
  const alerta = page.locator('.alert-danger');
  await expect(alerta).toBeVisible();
  await expect(alerta.locator('strong')).toHaveText('Error');
  await expect(alerta.locator('.validation-summary-errors li')).toHaveText(
    'Usuario o contraseña inválidos'
  );
  await expect(page).toHaveURL(LOGIN);

  // Sin sesión iniciada, la app vuelve a pedir login
  await page.goto('/');
  await expect(page).toHaveURL(LOGIN);
});

test('BD-LOGIN-03 | Login con campos vacíos', async ({ page }) => {
  await page.goto('/');

  // Click en Iniciar sesión sin completar usuario ni contraseña
  await page.locator('button.login-button').click();

  // Cada input muestra "Este campo es requerido" debajo. Se busca dentro del grupo
  // del input porque, si el click llega antes que la validación del navegador,
  // el mensaje lo renderiza el servidor sin los ids #Username-error y similares.
  for (const selector of ['#Username', '#login-password-input']) {
    const input = page.locator(selector);
    const error = page
      .locator('.login-form-group', { has: input })
      .locator('.field-validation-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Este campo es requerido');

    const cajaInput = (await input.boundingBox())!;
    const cajaError = (await error.boundingBox())!;
    expect(cajaError.y).toBeGreaterThanOrEqual(cajaInput.y + cajaInput.height);
  }
  await expect(page).toHaveURL(LOGIN);
});

test('BD-LOGOUT-01 | Cerrar sesión vuelve al login', async ({ page }) => {
  await login(page);
  await expect(page).toHaveTitle('Biblioteca digital');

  // Pausa de 2 segundos para ver la pantalla de Proyectos
  await page.waitForTimeout(2000);

  // Abrir el menú de la cuenta y hacer click en Cerrar sesión
  await page.locator('button.account-icon').click();
  await page.locator('.logout').click();

  await expect(page).toHaveURL(LOGIN);

  // Con la sesión cerrada, la app vuelve a pedir login
  await page.goto('/');
  await expect(page).toHaveURL(LOGIN);
});
