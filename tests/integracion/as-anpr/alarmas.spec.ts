import { test, expect } from '@playwright/test';
import { login, abrirPatentes, buscarPatente, crearPatente, asociarLista, eliminarPatente } from '../../anpr/administracion';
import { alarmasEnWidget, alarmaEnWidget, atenderAlarma, fechaDeAlarma } from '../../anpr/alarmas';
import { abrirAuditoriaDeAlarmas, buscar, alarmaEnAuditoria } from '../../anpr/auditoria';
import { verificarAsLibre, instalarAs, desinstalarAs, mitadDePantalla, maximizar, abrirVisor } from '../as';

// Integración AS → ANPR con alarmas: las patentes cargadas en una lista con alarma, al ser
// detectadas por AS, generan en ANPR alarmas Pendientes que el operador atiende y cierra.

// Las tres primeras patentes que detecta AS en el video (telepeaje6.avi), con el formato que les
// asigna ANPR
const PATENTES = [
  { patente: 'AC832JA', formato: 'Patente Única del Mercosur - Argentina - Autos' },
  { patente: 'NEW157', formato: 'Patentes de la República Argentina' },
  { patente: 'HKX319', formato: 'Patentes de la República Argentina' },
];
const NOMBRES = PATENTES.map((p) => p.patente).join(', ');
// Lista que tiene asociada la alarma "alarma testing AS"
const LISTA = 'LISTA TESTING AS';
const TIPO_ALARMA = 'alarma testing AS';
const ACCION = 'Válida - Alarma válida';
const COMENTARIO = 'Alarma atendida por el test automatizado INT-ALARMA-02';

test.describe.configure({ mode: 'serial' });
test.skip(!process.env.AS_HOST || !process.env.APP_USER, 'Falta AS_HOST o APP_USER en el .env');

let instalado = false;
const creadas: string[] = [];
// Alarma nueva de cada patente: id y fecha (según el servidor de ANPR)
const alarmas = new Map<string, { id: number; fecha: Date }>();

// Siempre se deja todo como estaba, aunque falle un test: AS desinstalado y las patentes borradas
test.afterAll(async ({ browser }, testInfo) => {
  testInfo.setTimeout(3 * 60_000);
  if (instalado) await desinstalarAs();
  if (creadas.length) {
    const page = await browser.newPage({ baseURL: process.env.BASE_URL, ignoreHTTPSErrors: true, viewport: null });
    await maximizar(page);
    await login(page);
    await abrirPatentes(page);
    for (const patente of creadas) {
      const fila = await buscarPatente(page, patente);
      if (await fila.count()) await eliminarPatente(page, fila);
    }
    await page.close();
  }
});

test(`INT-ALARMA-01 | ${NOMBRES} en "${LISTA}" detectadas por AS generan alarmas Pendientes`, async ({
  page,
  browser,
}) => {
  test.setTimeout(20 * 60_000);
  await verificarAsLibre();
  await maximizar(page);
  await login(page);

  // Alta de las patentes en la lista con alarma (si quedaron de una ejecución anterior, se recrean)
  await abrirPatentes(page);
  for (const { patente, formato } of PATENTES) {
    const anterior = await buscarPatente(page, patente);
    if (await anterior.count()) await eliminarPatente(page, anterior);
    await crearPatente(page, patente, formato);
    creadas.push(patente);
    await asociarLista(page, await buscarPatente(page, patente), LISTA);
  }

  // Panel de control a la izquierda y, al instalar, el video de AS a la derecha.
  // Última alarma antes de instalar: las nuevas tienen un id mayor.
  await mitadDePantalla(page, 'izquierda');
  await page.goto('index.php');
  await expect(page.locator('li.alarm_item:visible').first()).toBeVisible({ timeout: 30_000 });
  const ultimaAlarma = Math.max(0, ...(await alarmasEnWidget(page)).map((a) => a.id));

  instalado = true;
  await instalarAs();
  const visor = await abrirVisor(browser);

  // AS detecta las patentes y ANPR genera una alarma por cada una (se toma la primera)
  await expect
    .poll(
      async () => {
        const nuevas = (await alarmasEnWidget(page)).filter((a) => a.id > ultimaAlarma).reverse();
        for (const { patente } of PATENTES) {
          const alarma = nuevas.find((a) => a.patente === patente);
          if (alarma && !alarmas.has(patente)) {
            console.log(`  Alarma ${alarma.id} de ${patente}`);
            alarmas.set(patente, { id: alarma.id, fecha: await fechaDeAlarma(page, alarma.id) });
          }
        }
        return [...alarmas.keys()].sort();
      },
      { message: `Alarmas nuevas de ${NOMBRES} en el widget Alarmas`, timeout: 5 * 60_000, intervals: [5_000] }
    )
    .toEqual(PATENTES.map((p) => p.patente).sort());

  for (const [patente, { id }] of alarmas) {
    const alarma = (await alarmasEnWidget(page)).find((a) => a.id === id)!;
    expect(alarma.tipo, `Tipo de alarma de ${patente}`).toBe(TIPO_ALARMA);
    expect(alarma.estado, `Estado de la alarma de ${patente}`).toBe('pending');
    await expect(alarmaEnWidget(page, id).locator('.alarm_status:visible')).toHaveText('Pendiente');
  }

  await test.info().attach('alarmas-pendientes.png', { body: await page.screenshot(), contentType: 'image/png' });
  await test.info().attach('visor-4492.png', { body: await visor.screenshot(), contentType: 'image/png' });
  await visor.context().close();

  // Ya no hace falta que AS siga detectando: se desinstala para no generar más alarmas
  await desinstalarAs();
  instalado = false;
});

test(`INT-ALARMA-02 | Atender las alarmas de ${NOMBRES} como "${ACCION}" las deja Cerradas`, async ({ page }) => {
  expect(alarmas.size, 'Requiere las alarmas de INT-ALARMA-01').toBe(PATENTES.length);
  await maximizar(page);
  await login(page);

  for (const [patente, { id }] of alarmas) {
    await expect(alarmaEnWidget(page, id), `Alarma de ${patente}`).toBeVisible({ timeout: 30_000 });
    await atenderAlarma(page, id, ACCION, COMENTARIO);

    // El widget muestra la alarma cerrada y la acción elegida
    const item = alarmaEnWidget(page, id);
    await expect(item, `Alarma de ${patente} cerrada`).toHaveClass(/\bclosed\b/, { timeout: 15_000 });
    await expect(item.locator('.alarm_status:visible')).toHaveText('Cerrada');
    await expect(item.locator('.alarm_action')).toHaveText('Válida');
  }

  await test.info().attach('alarmas-cerradas.png', { body: await page.screenshot(), contentType: 'image/png' });
});

test(`INT-ALARMA-03 | Las alarmas atendidas de ${NOMBRES} quedan registradas en Auditoría`, async ({ page }) => {
  expect(alarmas.size, 'Requiere las alarmas de INT-ALARMA-01').toBe(PATENTES.length);
  await maximizar(page);
  await login(page);

  // Auditoría → Alarmas, por fecha de captura alrededor de las alarmas (una sola búsqueda para
  // las tres). La fecha se carga a mano porque, por defecto, Auditoría busca la última hora según
  // el reloj de esta PC, y el servidor de ANPR (que pone la hora de la alarma) puede estar adelantado.
  const fechas = [...alarmas.values()].map((a) => a.fecha.getTime());
  const diezMinutos = 10 * 60_000;
  await abrirAuditoriaDeAlarmas(
    page,
    new Date(Math.min(...fechas) - diezMinutos),
    new Date(Math.max(...fechas) + diezMinutos)
  );
  await buscar(page);

  for (const [patente, { id }] of alarmas) {
    const fila = alarmaEnAuditoria(page, id);
    // La celda muestra la patente y, debajo, el ejemplar si no es el original (por ejemplo "duplicado")
    await expect(fila.locator('.capture_result_list_patent p').first(), `Alarma de ${patente} en Auditoría`).toHaveText(
      patente
    );
    await expect(fila.locator('.alarm_audit_result_list_alarm_name')).toHaveText(TIPO_ALARMA);
    await expect(fila.locator('.alarm_audit_result_list_alarm_status')).toHaveText('Cerrada');
    await expect(fila.locator('.audit_alarm_result_list_userName')).toHaveText(process.env.APP_USER!);
    await expect(fila.locator('.audit_alarm_result_list_action')).toHaveText(ACCION);
  }
  await test.info().attach('auditoria-alarmas.png', { body: await page.screenshot(), contentType: 'image/png' });

  // El detalle de una de ellas muestra la atención con el comentario y el historial de la alarma
  const [patente, { id }] = [...alarmas][0];
  await alarmaEnAuditoria(page, id).locator('.capture_result_list_patent').click();
  const detalle = page.locator('#alarm_audit_modal');
  await expect(detalle).toBeVisible();
  await expect(detalle).toContainText(patente);
  await expect(detalle).toContainText(new RegExp(`Nombre lista:\\s*${LISTA}`, 'i'));
  await expect(detalle).toContainText(new RegExp(`Usuario:\\s*${process.env.APP_USER}`, 'i'));
  await expect(detalle).toContainText(/Acción:\s*Válida/i);
  await expect(detalle).toContainText(new RegExp(`Observación:\\s*${COMENTARIO}`, 'i'));
  await expect(detalle).toContainText('Capturada por la cámara');
  await expect(detalle).toContainText('Alarma cerrada con el mensaje');

  await test.info().attach('auditoria-detalle.png', { body: await page.screenshot(), contentType: 'image/png' });
});
