import { test, expect } from '@playwright/test';
import { ejecutar } from './ssh';
import { INSTALADOR as ARCHIVO, VERSION } from './instalador';

const DIR = process.env.AS_DIR!;
const INSTALADOR =
  `./${ARCHIVO} -a cuda -v ${VERSION} -j ./server_config_ANPR.json ` +
  `-f ${DIR}/videos_de_prueba -l ${DIR}/logs/`;
// Patentes distintas a esperar: con el video de telepeaje aparece una cada 5-20 segundos
const PATENTES_ESPERADAS = 5;
// AS informa la patente en cada cuadro en que la ve, y en algunos cuadros la lee mal (NAH903 en vez
// de NAM903). Una patente cuenta cuando tiene estas lecturas y le gana a sus variantes
const LECTURAS_MINIMAS = 10;

/** Difieren en un solo carácter: una es un error de lectura de la otra */
const variantes = (a: string, b: string) =>
  a !== b && a.length === b.length && [...a].filter((c, i) => c !== b[i]).length === 1;

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

test(`AS-ANPR-01 | La analítica detecta ${PATENTES_ESPERADAS} patentes distintas y guarda log y 3 fotos por patente`, async ({ page }) => {
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

  // Las detecciones se leen de los logs nuevos (logs/<cámara>/<año>/<mes>/<día>/<hora>/log_file_*.log).
  const texto = (d: Deteccion) => d.license_plates[0].text;
  let todas: Deteccion[] = [];
  let detecciones: Deteccion[] = [];
  await expect
    .poll(
      async () => {
        const { salida } = await ejecutar(
          `bash -c 'find ${DIR}/logs -name "log_file_*.log" -newermt @${inicio} ` +
            `-exec grep -h "\\"analytic\\":\\"anpr\\"" {} +'`
        );
        todas = salida
          .split('\n')
          .filter((linea) => linea.startsWith('{'))
          .map((linea) => JSON.parse(linea) as Deteccion)
          .filter((d) => Date.parse(d.date) / 1000 >= inicio)
          .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
        const lecturas = new Map<string, number>();
        for (const d of todas) lecturas.set(texto(d), (lecturas.get(texto(d)) ?? 0) + 1);
        const confirmada = (patente: string) =>
          lecturas.get(patente)! >= LECTURAS_MINIMAS &&
          [...lecturas].every(([otra, veces]) => !variantes(patente, otra) || veces < lecturas.get(patente)!);
        // En la consola se ve cada patente nueva a medida que se confirma
        for (const d of todas) {
          if (detecciones.length === PATENTES_ESPERADAS) break;
          const yaEsta = detecciones.some((o) => texto(o) === texto(d) || variantes(texto(o), texto(d)));
          if (!yaEsta && confirmada(texto(d))) {
            detecciones.push(d);
            console.log(`  Patente ${detecciones.length}/${PATENTES_ESPERADAS}: ${texto(d)}`);
          }
        }
        return detecciones.length;
      },
      { message: 'Patentes distintas detectadas desde la instalación', timeout: 5 * 60_000, intervals: [10_000] }
    )
    .toBe(PATENTES_ESPERADAS);

  const aviso =
    `${todas.length} detecciones de ${new Set(todas.map(texto)).size} lecturas distintas ` +
    `(AS informa la patente en cada cuadro y algunas lecturas son errores)`;
  console.log(`  ${aviso}`);
  test.info().annotations.push({ type: 'Detecciones de AS', description: aviso });

  await page.screenshot({ path: test.info().outputPath('visor-4492.png') });
  await test.info().attach('visor-4492.png', { path: test.info().outputPath('visor-4492.png') });

  // Cada patente tiene sus 3 fotos: la imagen, el recorte de la patente y la de referencia
  const resumen: string[] = [];
  for (const deteccion of detecciones) {
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
