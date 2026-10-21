import { test, expect } from '@playwright/test';
import { AppEscritorio, TextoEnPantalla } from '../../vms/windows';
import { iniciarSesion, dobleClicEnArbol } from '../../vms/control-center';
import {
  Analitica,
  verificarAsLibre,
  instalarAs,
  desinstalarAs,
  horaDelServidor,
  programarResiduos,
  ejecucionesResiduos,
  restaurarConfig,
} from '../as';

// Integración AS → VMS (Residuos): la analítica de residuos de AS (litter_detector) analiza la cámara
// de VMS en los horarios programados y manda cada evento a VMS. En Control Center aparece en el panel
// de Eventos y se abre su modal "Información del evento" con la foto y los datos.

const SISTEMA = 'system 145(testing)';
const GRUPO = 'Residuos';
const CAMARA = 'vlc_16_residuos, Channel  1';
const CAMARA_TEXTO = CAMARA.replace(/\s+/g, ' ');
const RESIDUOS: Analitica = { config: 'server_config_Residuos_VMS_145.json' };
const EVENTO = 'Desborde de residuos detectado';
const MODAL = 'Información del evento';
// Se abren los primeros 3 eventos y se corta
const EVENTOS = 3;
// La analítica se ejecuta cada 30 segundos durante 3 minutos (7 ejecuciones, por si AS saltea
// alguna), desde un minuto y medio después de programarla: así le da tiempo a instalarse
const MINUTOS = 3;
const CADA = 30;
const MARGEN = 90;

test.describe.configure({ mode: 'serial' });
test.skip(
  process.platform !== 'win32' || !process.env.VMS_USER || !process.env.AS_HOST,
  'Requiere Windows, VMS_USER y AS_HOST en el .env'
);

let instalado = false;
let programado = false;

// Siempre se deja todo como estaba, aunque falle: AS desinstalado y el JSON con sus horarios
test.afterAll(async ({}, testInfo) => {
  testInfo.setTimeout(3 * 60_000);
  if (instalado) await desinstalarAs(RESIDUOS);
  if (programado) await restaurarConfig(RESIDUOS.config);
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Eventos de residuos del panel de Eventos, del más nuevo (arriba) al más viejo. Se leen con OCR
 * sobre la imagen de la ventana: así se leen aunque otra aplicación quede encima.
 */
async function eventosEnControlCenter(vms: AppEscritorio) {
  const textos = await vms.textosConPosicion({ soloVentana: true });
  return textos.filter((t) => t.texto.includes(EVENTO)).sort((a, b) => a.y - b.y);
}

/**
 * Textos con el nombre de la cámara fuera del árbol (que también la muestra). El OCR lee
 * "vlc_16_residuos, Channel" como "VIC 16 residuos, Channel".
 */
async function camaraFueraDelArbol(vms: AppEscritorio) {
  const textos = await vms.textosConPosicion({ soloVentana: true });
  return textos.filter((t) => t.x > 450 && t.texto.includes('residuos, Channel'));
}

/** Título del modal "Información del evento" en pantalla (con OCR), o undefined si no está abierto */
async function tituloDelModal(vms: AppEscritorio) {
  return (await vms.textosConPosicion()).find((t) => t.texto.includes(MODAL));
}

/** Abre el modal del evento haciendo clic en su fila (si con un clic no se abre, con doble clic) */
async function abrirEvento(vms: AppEscritorio, fila: TextoEnPantalla) {
  for (const veces of [1, 2]) {
    await vms.clicEn(fila.x + fila.ancho / 2, fila.y + fila.alto / 2, veces);
    for (let i = 0; i < 6; i++) {
      await esperar(500);
      if (await tituloDelModal(vms)) return;
    }
  }
  throw new Error(`No se abrió el modal "${MODAL}"`);
}

/** Cierra el modal con su X (arriba a la derecha) */
async function cerrarEvento(vms: AppEscritorio) {
  const modal = await vms.modal(MODAL);
  if (modal && modal.ancho > 300) {
    await vms.clicEn(modal.x + modal.ancho - 33, modal.y + 24);
  } else {
    // El modal no se expone a la accesibilidad: la X está a la misma distancia del título siempre
    const titulo = (await tituloDelModal(vms))!;
    await vms.clicEn(titulo.x + 1028, titulo.y - 33);
  }
  await expect.poll(async () => !!(await tituloDelModal(vms)), { message: `Se cerró "${MODAL}"` }).toBe(false);
}

test(`INT-RES-01 | Los eventos de residuos de "${CAMARA_TEXTO}" llegan a Control Center y se ven en su modal`, async () => {
  test.setTimeout(15 * 60_000);
  await verificarAsLibre();

  // Control Center con la cámara abierta en vivo en el Panel principal
  const vms = await iniciarSesion(SISTEMA, process.env.VMS_USER!, process.env.VMS_PASSWORD!);
  const captura = async (nombre: string) =>
    test.info().attach(nombre, { body: await vms.capturaPantalla(), contentType: 'image/png' });
  try {
    await dobleClicEnArbol(vms, GRUPO, CAMARA);
    await expect
      .poll(async () => (await camaraFueraDelArbol(vms)).length, { message: `${CAMARA_TEXTO} abierta en el video` })
      .toBeGreaterThan(0);
    expect(await eventosEnControlCenter(vms), 'Sin eventos antes de instalar AS').toHaveLength(0);
    await captura('1-camara.png');

    // Horarios de ejecución desde la hora del servidor de AS (su reloj no coincide con el de la PC)
    const servidor = await horaDelServidor();
    const hora = (d: Date) => d.toTimeString().slice(0, 8);
    const horarios = Array.from({ length: (MINUTOS * 60) / CADA + 1 }, (_, i) =>
      hora(new Date(servidor.getTime() + (MARGEN + i * CADA) * 1000))
    );
    console.log(`  Hora del servidor ${hora(servidor)} → ejecuciones a las ${horarios.join(', ')}`);
    programado = true;
    await programarResiduos(RESIDUOS.config, horarios);
    instalado = true;
    await instalarAs(RESIDUOS);

    // Cada evento que llega se abre: el más nuevo queda arriba en el panel de Eventos. Se corta al
    // abrir 3 (o si se termina el tiempo de las ejecuciones programadas)
    let abiertos = 0;
    const fin = Date.now() + (MARGEN + MINUTOS * 60 + 60) * 1000;
    while (abiertos < EVENTOS && Date.now() < fin) {
      await esperar(5_000);
      const eventos = await eventosEnControlCenter(vms);
      if (eventos.length <= abiertos) continue;
      abiertos++;
      console.log(`  ${hora(new Date())} → evento ${abiertos} en Control Center: se abre su modal`);

      await abrirEvento(vms, eventos[0]);
      // El modal muestra la foto y los datos del evento: fuente, tipo y descripción
      const modal = (await vms.textosConPosicion()).map((t) => t.texto).join(' | ');
      expect(modal, `Modal del evento ${abiertos}`).toContain('Id de evento');
      expect(modal).toContain('Fuente');
      expect(modal).toMatch(/residuos, Channel/);
      expect(modal).toContain('Desborde de residuos');
      expect(modal).toContain(EVENTO);
      await captura(`2-evento-${abiertos}.png`);
      await cerrarEvento(vms);
    }
    await captura('3-eventos.png');
    expect(abiertos, `Eventos abiertos en Control Center`).toBe(EVENTOS);

    // Lo que dice AS: cada evento sale de una imagen analizada. Las ejecuciones que registra como
    // correctas o salteadas no siempre coinciden con los eventos (#37): quedan como aviso
    const { analizadas, correctas, salteadas } = await ejecucionesResiduos(servidor);
    console.log(`  AS hasta ahora: ${analizadas} imágenes analizadas, ${correctas} correctas, ${salteadas} salteadas`);
    if (salteadas) {
      test.info().annotations.push({
        type: 'Aviso',
        description:
          `AS registró ${salteadas} ejecuciones salteadas y ${correctas} correctas, con ${analizadas} imágenes ` +
          'analizadas (#37)',
      });
    }
    expect(analizadas, 'Imágenes analizadas por AS (una por evento)').toBeGreaterThanOrEqual(EVENTOS);
  } finally {
    await vms.cerrar();
  }
});
