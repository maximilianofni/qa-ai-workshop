import { test, expect, Page } from '@playwright/test';
import { login } from '../anpr/administracion';
import {
  verificarAsLibre,
  instalarAs,
  desinstalarAs,
  patentesDetectadas,
  mitadDePantalla,
  abrirVisor,
} from './as';

// Integración AS → ANPR: la analítica de AS detecta patentes en un video y las manda por webhook
// a ANPR, donde aparecen en el widget Lista del Panel de control.

const PATENTES_ESPERADAS = 5;
// Cámara y fuente de captura de ANPR asociadas al AS de testing
const CAMARA = 'Camara 1 Testing NO BORRAR';
const FUENTE = 'Capture Source NO BORRAR';
// Widget Lista visible (la página tiene además una plantilla oculta con la misma clase)
const LISTA = '.widget_list:visible';

test.describe.configure({ mode: 'serial' });
test.skip(!process.env.AS_HOST || !process.env.APP_USER, 'Falta AS_HOST o APP_USER en el .env');

let instalado = false;
// Última captura que había en ANPR antes de instalar: las nuevas tienen un id mayor
let ultimaCaptura = 0;
let patentes: string[] = [];

/** Capturas del widget Lista (se actualiza solo cada 5 segundos) */
function capturasEnLista(page: Page) {
  return page.locator(`${LISTA} li.list_capture`).evaluateAll((items) =>
    items.map((li) => ({
      id: Number(li.getAttribute('data-id-capture')),
      patente: li.querySelector('.capture_plate')?.textContent?.trim() ?? '',
      fuente: li.querySelector('.capture_source_name')?.textContent?.trim() ?? '',
    }))
  );
}

/** Capturas que llegaron a la Lista desde la instalación */
async function capturasNuevas(page: Page) {
  return (await capturasEnLista(page)).filter((c) => c.id > ultimaCaptura);
}

// La analítica se desinstala siempre, aunque falle un test, para no dejar el servidor ocupado
test.afterAll(async ({}, testInfo) => {
  if (!instalado) return;
  testInfo.setTimeout(3 * 60_000);
  await desinstalarAs();
});

test(`INT-ANPR-01 | Las ${PATENTES_ESPERADAS} patentes que detecta AS llegan al widget Lista de ANPR`, async ({
  page,
  browser,
}) => {
  test.setTimeout(20 * 60_000);

  // Antes de instalar: AS libre y la última captura que muestra ANPR
  await verificarAsLibre();
  await mitadDePantalla(page, 'izquierda');
  await login(page);
  await expect(page.locator(`${LISTA} li.list_capture`).first()).toBeVisible({ timeout: 30_000 });
  ultimaCaptura = Math.max(0, ...(await capturasEnLista(page)).map((c) => c.id));

  // Instalación con la configuración que manda las patentes a ANPR
  instalado = true;
  const { inicio, salida } = await instalarAs();
  await test.info().attach('salida-instalador.txt', { body: salida, contentType: 'text/plain' });
  const visor = await abrirVisor(browser);

  // Patentes que detectó AS, leídas de sus logs: son las que tienen que llegar a ANPR
  await expect
    .poll(
      async () => {
        patentes = (await patentesDetectadas(inicio)).slice(0, PATENTES_ESPERADAS);
        return patentes.length;
      },
      { message: 'Patentes detectadas por AS', timeout: 5 * 60_000, intervals: [10_000] }
    )
    .toBe(PATENTES_ESPERADAS);
  console.log(`  Patentes detectadas por AS: ${patentes.join(', ')}`);

  // Las mismas patentes aparecen en la Lista de ANPR, con la cámara del AS de testing
  await expect
    .poll(async () => (await capturasNuevas(page)).map((c) => c.patente), {
      message: 'Patentes nuevas en el widget Lista',
      timeout: 2 * 60_000,
      intervals: [5_000],
    })
    .toEqual(expect.arrayContaining(patentes));
  for (const captura of await capturasNuevas(page)) {
    expect(captura.fuente, `Fuente de ${captura.patente}`).toBe(`${FUENTE} (${CAMARA})`);
  }

  await test.info().attach('widget-lista.png', {
    body: await page.locator(LISTA).screenshot(),
    contentType: 'image/png',
  });
  await test.info().attach('visor-4492.png', { body: await visor.screenshot(), contentType: 'image/png' });
  await visor.context().close();
});

test('INT-ANPR-02 | El detalle de una patente detectada por AS muestra su información de captura', async ({ page }) => {
  expect(patentes, 'Requiere las patentes de INT-ANPR-01').toHaveLength(PATENTES_ESPERADAS);
  await mitadDePantalla(page, 'izquierda');
  await login(page);
  await expect(page.locator(`${LISTA} li.list_capture`).first()).toBeVisible({ timeout: 30_000 });

  // Se abre la captura nueva de la primera patente detectada
  const captura = (await capturasNuevas(page)).find((c) => c.patente === patentes[0])!;
  await page.locator(`${LISTA} li.list_capture[data-id-capture="${captura.id}"] .capture_plate`).click();

  const detalle = page.locator('#capture_full_modal');
  await expect(detalle).toBeVisible();
  await expect(detalle.locator('#original_plate_string')).toHaveText(patentes[0]);
  // Cada dato se busca por su etiqueta, como lo lee el usuario
  await expect(detalle).toContainText(new RegExp(`Fuente de captura:\\s*${FUENTE}`, 'i'));
  await expect(detalle).toContainText(new RegExp(`Cámara:\\s*${CAMARA}`, 'i'));
  await expect(detalle).toContainText(/Nivel de confianza:\s*\d+(\.\d+)?\s*%/i);

  await test.info().attach('detalle-patente.png', { body: await detalle.screenshot(), contentType: 'image/png' });
});
