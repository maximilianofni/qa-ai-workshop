import { expect, Page, Browser } from '@playwright/test';
import { ejecutar } from '../as/ssh';

/** Pasos de AS compartidos por los tests de integración (con ANPR y con VMS) */

const DIR = process.env.AS_DIR!;
const VERSION = '2.4-rc1';

/** Configuración con la que se instala AS (un JSON de AS_DIR) y opciones extra del instalador */
export interface Analitica {
  config: string;
  opciones?: string;
}

// A diferencia de server_config_ANPR.json, esta configuración manda cada patente al webhook de ANPR
const ANPR: Analitica = {
  config: 'server_config_ANPR_capture.json',
  opciones: `-f ${DIR}/videos_de_prueba -l ${DIR}/logs/`,
};

const instalador = ({ config, opciones }: Analitica) =>
  `./installer${VERSION}.sh -a cuda -v ${VERSION} -j ./${config}${opciones ? ` ${opciones}` : ''}`;

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
export async function instalarAs(analitica = ANPR): Promise<{ inicio: number; salida: string }> {
  const inicio = Number((await ejecutar('date +%s')).salida);
  const { salida } = await ejecutar(`bash -c 'cd ${DIR} && ${instalador(analitica)} -i'`, { sudo: true });
  expect(salida).toContain('Installation complete.');
  return { inicio, salida };
}

export async function desinstalarAs(analitica = ANPR) {
  const { salida } = await ejecutar(`bash -c 'cd ${DIR} && ${instalador(analitica)} -u'`, { sudo: true });
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

/** Hora del servidor de AS: su reloj no coincide con el de las PCs */
export async function horaDelServidor(): Promise<Date> {
  return new Date(Number((await ejecutar('date +%s')).salida) * 1000);
}

/**
 * Programa la analítica de residuos: reemplaza los últimos horarios (`execution_time`) de
 * `litter_detector_tasks` por los indicados (HH:MM:SS, hora del servidor). Antes guarda una copia
 * del JSON para dejarlo como estaba con `restaurarConfig`.
 */
export async function programarResiduos(config: string, horarios: string[]) {
  const ruta = `${DIR}/${config}`;
  const json = JSON.parse((await ejecutar(`cat ${ruta}`)).salida);
  const tareas: { execution_time: string }[] = json.cameras[0].programmable_tasks.litter_detector_tasks;
  tareas.splice(tareas.length - horarios.length, horarios.length, ...horarios.map((h) => ({ execution_time: h })));

  // -n: si quedó una copia de una ejecución que no terminó, esa es la original y no se pisa
  await ejecutar(`cp -n ${ruta} ${ruta}.qa-respaldo`);
  const base64 = Buffer.from(JSON.stringify(json, null, 2)).toString('base64');
  const { codigo } = await ejecutar(`bash -c 'echo ${base64} | base64 -d > ${ruta}'`);
  expect(codigo, `Escribir ${config}`).toBe(0);
}

/**
 * Resultado de las ejecuciones programadas de la analítica de residuos desde `desde` (hora del
 * servidor), según el log del servicio: las que analizaron una imagen de la cámara (cada una manda
 * un evento), las que AS dio por correctas y las que salteó. No siempre coinciden: si la cámara
 * tarda unos 10 segundos en conectar, AS analiza la imagen y manda el evento, pero igual registra la
 * ejecución como salteada.
 */
export async function ejecucionesResiduos(
  desde: Date
): Promise<{ analizadas: number; correctas: number; salteadas: number }> {
  const dos = (n: number) => String(n).padStart(2, '0');
  const fecha =
    `${desde.getFullYear()}-${dos(desde.getMonth() + 1)}-${dos(desde.getDate())} ` +
    `${dos(desde.getHours())}:${dos(desde.getMinutes())}:${dos(desde.getSeconds())}`;
  const { salida } = await ejecutar(`journalctl -u uip-analytics-server --since "${fecha}" --no-pager -o cat`, {
    sudo: true,
  });
  const contar = (texto: string) => salida.split('\n').filter((l) => l.includes(texto)).length;
  return {
    analizadas: contar('Video Manager has already processed'),
    correctas: contar('Programmable Task executed correctly.'),
    salteadas: contar('has been skipped for today'),
  };
}

/** Deja el JSON como estaba antes de `programarResiduos` */
export async function restaurarConfig(config: string) {
  const ruta = `${DIR}/${config}`;
  await ejecutar(`bash -c 'if [ -f ${ruta}.qa-respaldo ]; then mv ${ruta}.qa-respaldo ${ruta}; fi'`);
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
