import { test, expect } from '@playwright/test';
import { ejecutar } from './ssh';

const DIR = process.env.AS_DIR!;
const VERSION = '2.4-rc1';
const INSTALADOR =
  `./installer${VERSION}.sh -a cuda -v ${VERSION} -j ./server_config_ANPR.json ` +
  `-f ${DIR}/videos_de_prueba -l ${DIR}/logs/`;
// Cantidad de patentes a esperar: con el video de telepeaje aparece una cada 5-20 segundos
const PATENTES_ESPERADAS = 5;

interface Deteccion {
  date: string;
  file_name: string;
  license_plates: { text: string }[];
}

// Instalar, detectar y desinstalar dependen uno del otro: corren en orden
test.describe.configure({ mode: 'serial' });
// Instalan y desinstalan en el servidor: solo corren si el .env tiene el acceso SSH (no en CI)
test.skip(!process.env.AS_HOST, 'Falta AS_HOST en el .env');

let inicio: number;

test('AS-INSTALL-01 | El instalador con la analítica de ANPR termina con "Installation complete."', async () => {
  // La instalación puede bajar la imagen de Docker: se le da hasta 15 minutos
  test.setTimeout(15 * 60_000);
  // Hora del servidor (no de esta PC): los relojes pueden estar desfasados
  inicio = Number((await ejecutar('date +%s')).salida);

  const { salida, codigo } = await ejecutar(`bash -c 'cd ${DIR} && ${INSTALADOR} -i'`, { sudo: true });
  // La salida completa queda en el reporte, igual que se ve en PuTTY
  await test.info().attach('salida-instalador.txt', { body: salida, contentType: 'text/plain' });

  expect(salida).toContain(`analytics-server:${VERSION}`);
  expect(salida).toContain('Done, service enabled.');
  expect(salida).toContain('Installation complete.');
  expect(codigo).toBe(0);

  // El servicio queda corriendo después de instalar
  const servicio = await ejecutar('systemctl is-active uip-analytics-server');
  expect(servicio.salida.trim()).toBe('active');
});

test(`AS-ANPR-01 | La analítica detecta ${PATENTES_ESPERADAS} patentes y guarda log y 3 fotos por patente`, async ({ page }) => {
  test.setTimeout(6 * 60_000);

  // Se abre el visor de patentes detectadas: con --headed se ve el video con las detecciones.
  // Es un stream continuo, por eso alcanza con que llegue la respuesta ('commit').
  await expect
    .poll(
      async () => {
        const respuesta = await page
          .goto(`http://${process.env.AS_HOST}:4492/`, { waitUntil: 'commit', timeout: 5_000 })
          .catch(() => null);
        return respuesta?.status() ?? 0;
      },
      { message: 'El visor del puerto 4492 responde', timeout: 60_000, intervals: [3_000] }
    )
    .toBe(200);

  // Las detecciones se leen de los logs nuevos (logs/<cámara>/<año>/<mes>/<día>/<hora>/log_file_*.log)
  let detecciones: Deteccion[] = [];
  let mostradas = 0;
  await expect
    .poll(
      async () => {
        const { salida } = await ejecutar(
          `bash -c 'find ${DIR}/logs -name "log_file_*.log" -newermt @${inicio} ` +
            `-exec grep -h "\\"analytic\\":\\"anpr\\"" {} +'`
        );
        detecciones = salida
          .split('\n')
          .filter((linea) => linea.startsWith('{'))
          .map((linea) => JSON.parse(linea) as Deteccion)
          .filter((d) => Date.parse(d.date) / 1000 >= inicio);
        // En la consola se ve cada patente a medida que se detecta
        for (const d of detecciones.slice(mostradas, PATENTES_ESPERADAS)) {
          console.log(`  Patente ${++mostradas}/${PATENTES_ESPERADAS}: ${d.license_plates[0].text}`);
        }
        return detecciones.length;
      },
      { message: 'Patentes detectadas desde la instalación', timeout: 5 * 60_000, intervals: [10_000] }
    )
    .toBeGreaterThanOrEqual(PATENTES_ESPERADAS);

  await page.screenshot({ path: test.info().outputPath('visor-4492.png') });
  await test.info().attach('visor-4492.png', { path: test.info().outputPath('visor-4492.png') });

  // Cada patente tiene sus 3 fotos: la imagen, el recorte de la patente y la de referencia
  const resumen: string[] = [];
  for (const deteccion of detecciones.slice(0, PATENTES_ESPERADAS)) {
    const base = deteccion.file_name.replace(/\.jpg$/, '');
    const { salida } = await ejecutar(`bash -c 'find ${DIR}/logs -name "${base}*.jpg"'`);
    const rutas = salida.trim().split('\n').sort();
    resumen.push(deteccion.license_plates[0].text, ...rutas.map((r) => `    ${r}`));

    expect(rutas.map((r) => r.split('/').pop()), `Fotos de ${deteccion.license_plates[0].text}`).toEqual([
      `${base}.jpg`,
      `${base}_crop.jpg`,
      `${base}_ref.jpg`,
    ]);
  }
  console.log(`\n  Fotos guardadas en los logs:\n  ${resumen.join('\n  ')}\n`);
  await test.info().attach('patentes-detectadas.txt', { body: resumen.join('\n'), contentType: 'text/plain' });
});

test('AS-UNINSTALL-01 | El desinstalador quita el servicio de analíticas', async () => {
  test.setTimeout(2 * 60_000);

  const { salida, codigo } = await ejecutar(`bash -c 'cd ${DIR} && ${INSTALADOR} -u'`, { sudo: true });
  await test.info().attach('salida-desinstalador.txt', { body: salida, contentType: 'text/plain' });

  expect(salida).toContain('Uninstalling Analytics Server');
  expect(salida).toContain('Service has been uninstalled.');
  expect(salida).toContain('Done.');
  expect(codigo).toBe(0);

  // El servicio ya no está corriendo
  const servicio = await ejecutar('systemctl is-active uip-analytics-server');
  expect(servicio.salida.trim()).not.toBe('active');
});
