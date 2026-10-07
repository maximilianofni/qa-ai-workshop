import { expect, Page, Browser } from '@playwright/test';
import { ejecutar } from '../as/ssh';

/** Pasos de AS compartidos por los tests de integración con ANPR */

const DIR = process.env.AS_DIR!;
const VERSION = '2.4-rc1';
// A diferencia de server_config_ANPR.json, esta configuración manda cada patente al webhook de ANPR
const INSTALADOR =
  `./installer${VERSION}.sh -a cuda -v ${VERSION} -j ./server_config_ANPR_capture.json ` +
  `-f ${DIR}/videos_de_prueba -l ${DIR}/logs/`;

interface Deteccion {
  date: string;
  license_plates: { text: string }[];
}

/** Falla si AS ya está instalado: otra ejecución (por ejemplo Jenkins) puede estar usando el servidor */
export async function verificarAsLibre() {
  const servicio = await ejecutar('systemctl is-active uip-analytics-server');
  expect(servicio.salida.trim(), 'AS ya está instalado: ¿hay otra ejecución en curso?').not.toBe('active');
}

/** Instala la analítica y devuelve la hora del servidor al empezar (para leer solo los logs nuevos) */
export async function instalarAs(): Promise<{ inicio: number; salida: string }> {
  const inicio = Number((await ejecutar('date +%s')).salida);
  const { salida } = await ejecutar(`bash -c 'cd ${DIR} && ${INSTALADOR} -i'`, { sudo: true });
  expect(salida).toContain('Installation complete.');
  return { inicio, salida };
}

export async function desinstalarAs() {
  const { salida } = await ejecutar(`bash -c 'cd ${DIR} && ${INSTALADOR} -u'`, { sudo: true });
  expect(salida).toContain('Service has been uninstalled.');
}

/** Patentes que detectó AS desde `inicio`, leídas de sus logs y en orden de detección */
export async function patentesDetectadas(inicio: number): Promise<string[]> {
  const { salida } = await ejecutar(
    `bash -c 'find ${DIR}/logs -name "log_file_*.log" -newermt @${inicio} ` +
      `-exec grep -h "\\"analytic\\":\\"anpr\\"" {} +'`
  );
  return salida
    .split('\n')
    .filter((linea) => linea.startsWith('{'))
    .map((linea) => JSON.parse(linea) as Deteccion)
    .filter((d) => Date.parse(d.date) / 1000 >= inicio)
    .map((d) => d.license_plates[0].text);
}

/**
 * Sin --headed no hay pantalla real (la ventana mide 800x600): acomodar la ventana solo la achica
 */
async function sinVentana(page: Page) {
  return (await page.evaluate(() => navigator.userAgent)).includes('Headless');
}

/**
 * Ubica la ventana del navegador en una mitad de la pantalla: con --headed se ven lado a lado
 * la web de ANPR y el video que analiza AS.
 */
export async function mitadDePantalla(page: Page, lado: 'izquierda' | 'derecha') {
  if (await sinVentana(page)) return;
  const pantalla = await page.evaluate(() => ({ ancho: screen.availWidth, alto: screen.availHeight }));
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await cdp.send('Browser.setWindowBounds', {
    windowId,
    bounds: {
      left: lado === 'izquierda' ? 0 : Math.floor(pantalla.ancho / 2),
      top: 0,
      width: Math.floor(pantalla.ancho / 2),
      height: pantalla.alto,
    },
  });
}

/** Maximiza la ventana del navegador (después de haberla puesto en una mitad de la pantalla) */
export async function maximizar(page: Page) {
  if (await sinVentana(page)) return;
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
}

/** Abre en otra ventana el visor de AS con el video y las patentes que va detectando */
export async function abrirVisor(browser: Browser) {
  const visor = await (await browser.newContext({ viewport: null })).newPage();
  await mitadDePantalla(visor, 'derecha');
  // Es un stream continuo: alcanza con que llegue la respuesta ('commit')
  await expect
    .poll(
      async () =>
        (
          await visor
            .goto(`http://${process.env.AS_HOST}:4492/`, { waitUntil: 'commit', timeout: 5_000 })
            .catch(() => null)
        )?.status() ?? 0,
      { message: 'El visor del puerto 4492 responde', timeout: 60_000, intervals: [3_000] }
    )
    .toBe(200);
  return visor;
}
