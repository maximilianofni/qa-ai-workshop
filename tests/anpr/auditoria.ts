import { expect, Page } from '@playwright/test';

/** Fecha como la escribe el calendario de Auditoría: 2026-10-07 18:58:54 */
function formatoFecha(fecha: Date) {
  const d = (n: number) => String(n).padStart(2, '0');
  return (
    `${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())} ` +
    `${d(fecha.getHours())}:${d(fecha.getMinutes())}:${d(fecha.getSeconds())}`
  );
}

/**
 * Auditoría → Alarmas → Buscar alarmas, con el filtro de fecha de captura (Desde / Hasta) y,
 * si se indica, el de patente (Igual a)
 */
export async function abrirAuditoriaDeAlarmas(page: Page, desde: Date, hasta: Date, patente?: string) {
  await page.goto('auditoria.php');
  await page.locator('button.ms-choice:visible').first().click();
  await page.locator('.ms-drop:visible label').filter({ hasText: /^\s*Alarmas\s*$/ }).click();
  await page.getByText('Buscar alarmas').filter({ visible: true }).click();

  if (patente) {
    await page.locator('h3 a:visible').filter({ hasText: /^\s*Patente\s*$/ }).click();
    await page.locator('input[name="plateString"]:visible').fill(patente);
  }

  // Sin fechas, Auditoría busca la última hora según el reloj de esta PC
  await page.locator('h3 a:visible').filter({ hasText: /Fecha de Captura/ }).click();
  for (const [campo, fecha] of [
    ['input.datetimepickerFrom:visible', desde],
    ['input.datetimepickerTo:visible', hasta],
  ] as const) {
    await page.locator(campo).fill(formatoFecha(fecha));
    await page.locator(campo).press('Tab');
    await expect(page.locator(campo)).toHaveValue(formatoFecha(fecha));
  }
}

/** Aprieta la lupa y espera los resultados */
export async function buscar(page: Page) {
  // El calendario de las fechas se vuelve a abrir con cualquier clic y puede tapar la lupa:
  // el clic se manda directo al botón
  await page.locator('#audit-trigger').dispatchEvent('click');
  await expect(page.getByText(/Resultados Encontrados/)).toBeVisible();
}

/**
 * Fila de resultados de una alarma (por su id). La fila en sí mide 0 de alto (lo que se ve es
 * su contenido): la visibilidad se verifica en sus celdas.
 */
export function alarmaEnAuditoria(page: Page, id: number) {
  return page.locator(`div.alarm_item[data-id="${id}"]`);
}
