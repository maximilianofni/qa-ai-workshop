import { expect, Page, Locator } from '@playwright/test';

/** Acciones de Administración de ANPR, como las haría el usuario desde la web */

export async function login(page: Page) {
  await page.goto('login.php');
  await page.locator('input[name="userName"]').fill(process.env.APP_USER!);
  await page.locator('input[name="password"]').fill(process.env.APP_PASSWORD!);
  await page.locator('button.login-submit').click();
  await expect(page).toHaveURL(/index\.php/);
}

/** Abre Administración → Patentes */
export async function abrirPatentes(page: Page) {
  await page.goto('administracion.php');
  await page.getByText('Patentes', { exact: true }).first().click();
  await expect(page.locator('#currentAbmHeaderTitle')).toHaveText('Administración de Patentes');
  await expect(page.locator('.admin_abm_plates .result_list').first()).toBeVisible();
}

/** Busca la patente con el buscador (filtra al apretar Enter) y devuelve su fila */
export async function buscarPatente(page: Page, patente: string): Promise<Locator> {
  await page.locator('#search_bar').fill(patente);
  await page.locator('#search_bar').press('Enter');

  const nombres = page.locator('.admin_abm_plates .result_list:visible .admin_abm_result_list_name');
  // Espera a que la tabla muestre el resultado de esta búsqueda: la patente o ningún resultado
  await expect(async () => {
    const sinResultados = await page.getByText('No hay resultados que coincidan').isVisible();
    const filas = (await nombres.allTextContents()).map((n) => n.trim());
    expect(sinResultados || (filas.length > 0 && filas.every((n) => n.includes(patente)))).toBe(true);
  }).toPass({ timeout: 10_000 });

  return page.locator('.admin_abm_plates .result_list:visible').filter({
    has: page.locator('.admin_abm_result_list_name', { hasText: new RegExp(`^\\s*${patente}\\s*$`) }),
  });
}

/** Da de alta la patente con su formato (Agregar → Guardar) */
export async function crearPatente(page: Page, patente: string, formato: string) {
  await page.locator('a.add_abm_item:visible').click();
  const modal = page.locator('#admin_abm_plates_modal');
  await expect(modal).toBeVisible();
  await modal.locator('input[name="plateString"]').fill(patente);
  // El formato no es un desplegable común: se abre la lista y se elige la opción
  await modal.locator('button.ms-choice').first().click();
  await modal.locator('.ms-drop label').filter({ hasText: new RegExp(`^\\s*${formato}\\s*$`) }).click();
  await expect(modal.locator('button.ms-choice').first()).toContainText(formato);
  await modal.getByText('Guardar', { exact: true }).click();
  // Si algo falla, el modal queda abierto con el error
  await expect(modal, `Error al guardar: ${await modal.locator('#errorInModal').textContent()}`).toBeHidden();
}

/** Asocia la patente a una lista (Asociar listas a la patente → Agregar → Finalizar) */
export async function asociarLista(page: Page, fila: Locator, lista: string) {
  await fila.locator('input[type="radio"]').check();
  await page.locator('a.addList_abm_item:visible').click();
  const modal = page.locator('#admin_abm_plates_add_list_modal');
  await expect(modal).toBeVisible();

  await modal.locator('button.ms-choice').click();
  await modal.locator('.ms-drop label').filter({ hasText: new RegExp(`^\\s*${lista}\\s*$`) }).click();
  await modal.locator('#confirmAddListFromPlate a').click();
  await expect(modal.locator('#listCurrentLists')).toContainText(lista);

  await modal.getByText('Finalizar', { exact: true }).click();
  await expect(modal).toBeHidden();
}

/** Elimina la patente (Eliminar → Confirmar) */
export async function eliminarPatente(page: Page, fila: Locator) {
  await fila.locator('input[type="radio"]').check();
  await page.locator('a.delete_abm_item:visible').click();
  const modal = page.locator('#deleteItemModal');
  await expect(modal).toContainText('¿Está seguro que desea eliminar este elemento?');
  await modal.locator('#delete-current-item').click();
  await expect(modal).toBeHidden();
}
