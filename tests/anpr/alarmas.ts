import { expect, Page } from '@playwright/test';

/** Widget Alarmas del Panel de control (se actualiza solo cada pocos segundos) */

export interface Alarma {
  id: number;
  patente: string;
  tipo: string;
  /** pending, ongoing o closed */
  estado: string;
}

/** Alarmas que muestra el widget, de la más nueva a la más vieja */
export function alarmasEnWidget(page: Page): Promise<Alarma[]> {
  return page.locator('li.alarm_item:visible').evaluateAll((items) =>
    items.map((li) => ({
      id: Number(li.getAttribute('data-id')),
      patente: li.querySelector('.alarm_plate')?.textContent?.trim() ?? '',
      tipo: li.querySelector('.alarm_type')?.textContent?.trim() ?? '',
      estado: ['pending', 'ongoing', 'closed'].find((e) => li.classList.contains(e)) ?? '',
    }))
  );
}

/** Fecha y hora de la alarma según el servidor de ANPR (la que usa Auditoría para filtrar) */
export async function fechaDeAlarma(page: Page, id: number): Promise<Date> {
  const datos = await alarmaEnWidget(page, id).locator('.alarm_item_raw_data').inputValue();
  // Viene como "2026-10-07 18:58:54.649037", en la hora local del servidor
  return new Date((JSON.parse(datos).dateTime as string).replace(' ', 'T').slice(0, 23));
}

export function alarmaEnWidget(page: Page, id: number) {
  return page.locator(`li.alarm_item[data-id="${id}"]:visible`);
}

/**
 * Atiende la alarma desde el widget: la abre, Atender (pasa a En curso), elige la acción,
 * escribe el comentario y Guardar.
 */
export async function atenderAlarma(page: Page, id: number, accion: string, comentario: string) {
  await alarmaEnWidget(page, id).locator('.alarm_plate').click();
  const modal = page.locator('#look-alarm-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toHaveClass(/\bpending\b/);

  await modal.locator('a.take-alarm-event-btn.from-modal').click();
  await expect(modal).toContainText('Seleccione una acción para cerrar la alarma');
  await expect(modal).toContainText('En curso');

  // La acción puede ser un desplegable común o una lista personalizada, según el widget
  const combo = modal.locator('button.ms-choice:visible');
  if (await combo.count()) {
    await combo.first().click();
    await modal.locator('.ms-drop label:visible').filter({ hasText: accion }).first().click();
    await expect(combo.first()).toContainText(accion);
  } else {
    await modal.locator('select:visible').first().selectOption({ label: accion });
  }

  await modal.locator('textarea:visible').first().fill(comentario);
  await modal.getByText('Guardar', { exact: true }).filter({ visible: true }).click();
  await expect(modal).toBeHidden();
}
