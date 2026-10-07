import { test, expect } from '@playwright/test';
import { login, abrirPatentes, buscarPatente, crearPatente, asociarLista, eliminarPatente } from './administracion';

// Patente del video de AS (telepeaje6.avi), la primera que detecta. Se carga en una lista con
// alarma para que, al volver a detectarla, ANPR genere una alarma para atender.
const PATENTES = [{ patente: 'AC832JA', formato: 'Patente Única del Mercosur - Argentina - Autos' }];
// Lista asociada a la alarma "alarma testing AS"
const LISTA = 'LISTA TESTING AS';

// El alta y la baja usan las mismas patentes: corren en orden
test.describe.configure({ mode: 'serial' });

test(`ADM-PAT-01 | Alta de patentes asociadas a la lista "${LISTA}"`, async ({ page }) => {
  await login(page);
  await abrirPatentes(page);

  for (const { patente, formato } of PATENTES) {
    // Si quedó de una ejecución anterior que no llegó a la baja, se borra para empezar de cero
    const anterior = await buscarPatente(page, patente);
    if (await anterior.count()) await eliminarPatente(page, anterior);

    await crearPatente(page, patente, formato);
    const fila = await buscarPatente(page, patente);
    await expect(fila, `${patente} dada de alta`).toHaveCount(1);
    await expect(fila.locator('.admin_abm_result_list_format')).toHaveText(formato);

    await asociarLista(page, fila, LISTA);
    await expect((await buscarPatente(page, patente)).locator('.admin_abm_result_list_lists')).toHaveText(LISTA);
  }

  // Captura con las patentes nuevas en la tabla
  await page.locator('#search_bar').fill('');
  await page.locator('#search_bar').press('Enter');
  await test.info().attach('patentes.png', { body: await page.screenshot(), contentType: 'image/png' });
});

test('ADM-PAT-02 | Baja de las patentes dadas de alta', async ({ page }) => {
  await login(page);
  await abrirPatentes(page);

  for (const { patente } of PATENTES) {
    const fila = await buscarPatente(page, patente);
    await expect(fila, `${patente} existe antes de la baja`).toHaveCount(1);
    await eliminarPatente(page, fila);

    // Ya no aparece al buscarla
    await buscarPatente(page, patente);
    await expect(page.getByText('No hay resultados que coincidan')).toBeVisible();
  }
});
