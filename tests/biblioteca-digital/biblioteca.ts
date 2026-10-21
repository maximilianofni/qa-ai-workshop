import { expect, Page } from '@playwright/test';

/** Acciones de Biblioteca Digital, como las haría el usuario desde la web */

export async function login(page: Page, password = process.env.BD_PASSWORD!) {
  await page.goto(process.env.BD_BASE_URL!);
  await page.locator('#Username').fill(process.env.BD_USER!);
  await page.locator('#login-password-input').fill(password);
  await page.locator('button.login-button').click();
}

/** Busca en Proyectos por nombre (el buscador filtra al apretar Enter) y devuelve su fila */
export async function buscarProyecto(page: Page, nombre: string) {
  await page.goto(process.env.BD_BASE_URL!);
  const buscador = page.locator('input[type="text"]').first();
  await buscador.fill(nombre);
  await buscador.press('Enter');
  // La fila es la caja más chica que tiene el nombre y el resumen de cámaras
  return page
    .locator('[class*="row"]')
    .filter({ has: page.getByText(nombre, { exact: true }) })
    .filter({ hasText: 'Total de:' })
    .last();
}

/** Abre el detalle del proyecto desde su fila */
export async function abrirProyecto(page: Page, nombre: string) {
  // El nombre está dos veces (una oculta, para pantallas chicas): se hace clic en el visible
  await page.getByText(nombre, { exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/details/);
  const cabecera = page.locator('.v-expansion-panel-header');
  await expect(cabecera.locator('.project-name')).toHaveText(nombre);
  return {
    estado: cabecera.locator('.status'),
    descripcion: cabecera.locator('.description').first(),
    organismo: cabecera.locator('.description').last(),
    // Pestaña "Extracciones remotas": una fila por cámara, con nombre, tamaño y estado
    extracciones: page.locator('.cameras-table tbody tr'),
  };
}
