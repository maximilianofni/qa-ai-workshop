import { expect } from '@playwright/test';
import { AppEscritorio } from './windows';

/**
 * Pasos de Control Center (VMS), como los haría una persona. Muchas partes de la pantalla se
 * dibujan sin exponerse a la accesibilidad (el menú, el árbol de cámaras, el formulario web):
 * esas se encuentran con OCR o por su posición y se manejan con el mouse y el teclado.
 */

export const PANEL = 1480; // Los controles del panel derecho (Configuración, General) empiezan en esta x

/** Abre Control Center, elige el sistema e inicia sesión */
export async function iniciarSesion(sistema: string, usuario: string, password: string) {
  const vms = await AppEscritorio.abrir('XDRControlCenter.exe');
  try {
    await expect.poll(() => vms.textos(), { timeout: 30_000 }).toContain('INICIAR SESIÓN');

    await vms.elegirSistema(sistema);
    await expect.poll(() => vms.sistema()).toBe(sistema);

    await vms.escribir(0, usuario);
    await vms.escribir(1, password);
    await vms.clic('INICIAR SESIÓN');
    await expect.poll(() => vms.textos(), { timeout: 60_000, intervals: [1_000] }).toContain('Sistemas disponibles');
    return vms;
  } catch (error) {
    // Si el login falla, el test todavía no tiene la app para cerrarla: se cierra acá
    await vms.cerrar();
    throw error;
  }
}

/** Menú ☰ → EXTRACCIONES */
export async function abrirExtracciones(vms: AppEscritorio) {
  await vms.clicEnVentana(42, 24);
  await expect.poll(async () => (await vms.textosConPosicion()).map((t) => t.texto)).toContain('EXTRACCIONES');
  await vms.clicEnTexto('EXTRACCIONES');
  await expect.poll(() => vms.textos(), { timeout: 15_000 }).toContain('ESTABLECER VALORES');
}

/** Abre la cámara con doble clic en el árbol; si no se ve, primero despliega su grupo */
export async function abrirCamara(vms: AppEscritorio, grupo: string, camara: string) {
  await dobleClicEnArbol(vms, grupo, camara);
  await expect
    .poll(async () => (await vms.textos()).some((t) => t.startsWith(`Configuración - ${camara}`)), {
      message: `Configuración de ${camara}`,
      timeout: 15_000,
    })
    .toBe(true);
}

/**
 * Doble clic en la cámara del árbol de Sistemas disponibles; si no se ve, primero despliega su
 * grupo. En el Panel principal la abre en vivo; en Extracciones, para configurar su período.
 */
export async function dobleClicEnArbol(vms: AppEscritorio, grupo: string, camara: string) {
  // El OCR no siempre lee el canal ("camara Balcon, Channel"): se busca por lo que va antes de la coma.
  // Tampoco lee bien los guiones bajos ni la "l" ("vlc_16_residuos" → "VIC 16 residuos"): se comparan
  // sin mayúsculas ni signos, y con "l", "i" y "1" como la misma letra
  const comparable = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/[i1]/g, 'l');
  const nombre = comparable(camara.split(',')[0]);
  const visible = async () =>
    (await vms.textosConPosicion()).find((t) => comparable(t.texto).startsWith(nombre));
  // Después del login el árbol tarda unos segundos en cargarse
  await expect
    .poll(async () => (await vms.textosConPosicion()).some((t) => t.texto.includes(grupo)), {
      message: `Se ve el grupo ${grupo}`,
      timeout: 30_000,
    })
    .toBe(true);
  if (!(await visible())) {
    // La flecha para desplegar el grupo está a la izquierda de su ícono
    const g = await vms.buscarTexto(grupo);
    await vms.clicEn(g.x - 50, g.y + g.alto / 2);
    await expect.poll(async () => !!(await visible()), { message: `Se ve ${camara}` }).toBe(true);
  }
  const c = (await visible())!;
  await vms.clicEn(c.x + c.ancho / 2, c.y + c.alto / 2, 2);
}

/** Período a extraer: fecha y hora de inicio y duración en minutos → ESTABLECER VALORES */
export async function configurarPeriodo(vms: AppEscritorio, inicio: Date, minutos: number) {
  const dd = (n: number, largo = 2) => String(n).padStart(largo, '0');
  // Los 10 campos del panel, en orden de lectura: día, mes, año, hora, minuto, segundo y la
  // duración en días, horas, minutos y segundos
  const valores = [
    dd(inicio.getDate()),
    dd(inicio.getMonth() + 1),
    String(inicio.getFullYear()),
    dd(inicio.getHours()),
    dd(inicio.getMinutes()),
    dd(inicio.getSeconds()),
    '000',
    dd(Math.floor(minutos / 60)),
    dd(minutos % 60),
    '00',
  ];
  const campos = (await vms.campos()).filter((c) => c.x > PANEL).sort((a, b) => a.y - b.y || a.x - b.x);
  expect(campos, 'Campos de fecha, hora y duración').toHaveLength(valores.length);
  for (const [i, c] of campos.entries()) await vms.escribirEnPosicion(c.x, c.y, valores[i]);
  await vms.clicReal('ESTABLECER VALORES');
}
