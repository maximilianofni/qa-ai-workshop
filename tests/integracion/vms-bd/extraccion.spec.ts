import { test, expect, Page } from '@playwright/test';
import { AppEscritorio } from '../../vms/windows';
import { PANEL, iniciarSesion, abrirExtracciones, abrirCamara, configurarPeriodo } from '../../vms/control-center';
import { login, buscarProyecto, abrirProyecto } from '../../biblioteca-digital/biblioteca';

// Integración VMS → Biblioteca Digital: desde Control Center se pide una extracción remota de una
// cámara con grabación y llega a Biblioteca Digital como un proyecto con su extracción.

const SISTEMA = 'system 145(testing)';
const GRUPO = 'Eventos Irisity';
// Control Center muestra el nombre con dos espacios antes del canal; Biblioteca Digital, con uno
const CAMARA = 'camara Balcon, Channel  1';
const CAMARA_TEXTO = CAMARA.replace(/\s+/g, ' ');
const MINUTOS = 10;
const ORGANISMO = 'Testing';
const COMENTARIO = 'Extraccion remota del test automatizado - workshop QA';
// Información adicional (formulario web): ubicación, causa y carátula; el delito es el primero de la lista
const UBICACION = 'Balcon - prueba automatizada';
const REFERENCIA = 'QA-123/2026';
const CARATULA = 'Workshop QA - extraccion remota';

// El nombre identifica las extracciones del test (Control Center no acepta ":" en el nombre)
const ahora = new Date();
const dd = (n: number) => String(n).padStart(2, '0');
const NOMBRE =
  `QA-AUTO ${ahora.getFullYear()}${dd(ahora.getMonth() + 1)}${dd(ahora.getDate())}-` +
  `${dd(ahora.getHours())}${dd(ahora.getMinutes())}${dd(ahora.getSeconds())}`;
// Desde hace media hora: ese tramo ya está grabado
const INICIO = new Date(ahora.getTime() - 30 * 60_000);

test.describe.configure({ mode: 'serial' });
test.skip(
  process.platform !== 'win32' || !process.env.VMS_USER || !process.env.BD_USER,
  'Requiere Windows, VMS_USER y BD_USER en el .env'
);

// La web de Biblioteca Digital se ve siempre, al lado de Control Center: es parte de lo que se muestra
test.use({ headless: false });

let confirmada = false;
let web: Page;

// Biblioteca Digital abierta desde el principio, en Proyectos, con la sesión iniciada
test.beforeAll(async ({ browser }) => {
  web = await (await browser.newContext({ viewport: null, ignoreHTTPSErrors: true })).newPage();
  await login(web);
  await expect(web.locator('p.username')).toHaveText(process.env.BD_USER!);
});

test.afterAll(async () => {
  await web?.context().close();
});

test(`INT-EXT-01 | Extracción remota de ${MINUTOS} minutos de "${CAMARA_TEXTO}" desde Control Center`, async () => {
  test.setTimeout(5 * 60_000);
  const vms: AppEscritorio = await iniciarSesion(SISTEMA, process.env.VMS_USER!, process.env.VMS_PASSWORD!);
  const captura = async (nombre: string) =>
    test.info().attach(nombre, { body: await vms.capturaPantalla(), contentType: 'image/png' });

  try {
    // Extracciones: la cámara y el período
    await abrirExtracciones(vms);
    await abrirCamara(vms, GRUPO, CAMARA);
    await configurarPeriodo(vms, INICIO, MINUTOS);
    await captura('1-periodo.png');
    await vms.clicReal('SIGUIENTE');

    // General: nombre, tipo, organismo y comentarios
    await expect.poll(() => vms.textos()).toContain('Extracción local');
    await vms.elegirEnCombo('Extracción local', 'Extracción remota');
    await expect.poll(() => vms.textos()).toContain('Seleccione un organismo');
    await vms.elegirEnCombo('Seleccione un organismo', ORGANISMO);
    await expect.poll(() => vms.textos()).toContain(ORGANISMO);
    // El nombre y los comentarios se tipean: escritos sin teclado, la app no los toma
    const campos = (await vms.campos()).filter((c) => c.x > PANEL).sort((a, b) => a.y - b.y);
    const nombre = campos[0];
    const comentarios = campos[campos.length - 1];
    await vms.tipearEn(nombre.x + 20, nombre.y + 8, NOMBRE);
    await vms.tipearEn(comentarios.x + 20, comentarios.y + 8, COMENTARIO);
    await expect.poll(() => vms.textos()).toEqual(expect.arrayContaining([NOMBRE, COMENTARIO]));
    await captura('2-general.png');
    await vms.clicReal('SIGUIENTE');

    // Información adicional: página web dentro de la app, se completa por posición
    await expect.poll(() => vms.textos(), { timeout: 15_000 }).toContain('Extracción remota - Información adicional');
    const web = await vms.paginaWeb();
    await vms.tipearEn(web.x + 342, web.y + 130, UBICACION);
    await vms.tipearEn(web.x + 342, web.y + 174, REFERENCIA);
    await vms.tipearEn(web.x + 342, web.y + 218, CARATULA);
    await vms.clicEn(web.x + 82, web.y + 254);
    await captura('3-informacion-adicional.png');
    // El SIGUIENTE del diálogo (el del panel queda más abajo)
    await vms.clicReal('SIGUIENTE');

    // Resumen: Lista de extracciones → CONFIRMAR
    await expect.poll(() => vms.textos(), { timeout: 15_000 }).toContain('CONFIRMAR');
    await captura('4-resumen.png');
    await vms.clicReal('CONFIRMAR');
    confirmada = true;

    // La extracción queda en el panel Extracciones
    await expect
      .poll(() => vms.textos(), { timeout: 30_000 })
      .toContain(`${NOMBRE} - Extracción remota`);
    await captura('5-extraccion-enviada.png');
  } finally {
    await vms.cerrar();
  }
});

test(`INT-EXT-02 | La extracción llega a Biblioteca Digital como proyecto Finalizado con "${CAMARA_TEXTO}"`, async () => {
  test.setTimeout(15 * 60_000);
  expect(confirmada, 'Requiere la extracción de INT-EXT-01').toBe(true);
  // Control Center ya se cerró: queda a la vista la web de Biblioteca Digital
  const page = web;
  await page.bringToFront();

  // El proyecto aparece en Proyectos con la descripción y una cámara (el organismo se revisa en el
  // detalle); Biblioteca lo procesa y pasa a Finalizado (se vuelve a buscar hasta que termine)
  await expect
    .poll(
      async () => {
        const fila = await buscarProyecto(page, NOMBRE);
        return (await fila.count()) ? (await fila.innerText()).replace(/\s+/g, ' ') : '';
      },
      { message: `Proyecto ${NOMBRE} Finalizado`, timeout: 12 * 60_000, intervals: [15_000] }
    )
    .toMatch(new RegExp(`${COMENTARIO}.*Total de: 1 cámara.*Finalizado`));
  await buscarProyecto(page, NOMBRE);
  await test.info().attach('proyectos.png', { body: await page.screenshot(), contentType: 'image/png' });

  // Detalle: los datos del proyecto y la extracción de la cámara, terminada y con video
  const detalle = await abrirProyecto(page, NOMBRE);
  await expect(detalle.estado).toHaveText('Finalizado');
  await expect(detalle.descripcion).toHaveText(COMENTARIO);
  await expect(detalle.organismo).toHaveText(ORGANISMO);
  await expect(detalle.extracciones).toHaveCount(1);
  const extraccion = detalle.extracciones.first();
  await expect(extraccion).toContainText(CAMARA_TEXTO);
  await expect(extraccion).toContainText('Finalizado');
  const tamano = Number((await extraccion.innerText()).match(/([\d.]+)\s*MB/)?.[1] ?? 0);
  expect(tamano, 'Tamaño de la extracción (MB)').toBeGreaterThan(0);
  await test.info().attach('detalle.png', { body: await page.screenshot(), contentType: 'image/png' });
});
