import { test, expect } from '@playwright/test';
import { AppEscritorio } from './windows';

// VMS es una aplicación de escritorio de Windows: solo corre en Windows y con el usuario en el .env
test.skip(process.platform !== 'win32' || !process.env.VMS_USER, 'Requiere Windows y VMS_USER en el .env');

const APLICACIONES = [
  {
    prefijo: 'VMS-CC',
    nombre: 'Control Center',
    exe: 'XDRControlCenter.exe',
    // Ventana principal después del login
    titulo: 'UltraIp Control Center',
    textos: ['Sistemas disponibles', 'Eventos', 'Reproducción'],
  },
  {
    prefijo: 'VMS-CFG',
    nombre: 'Configurator',
    exe: 'XDRConfigurator.exe',
    titulo: 'Configurator',
    textos: ['Estado del sistema', 'Servidores'],
  },
];

/** Abre la app, completa usuario y contraseña y hace clic en INICIAR SESIÓN */
async function iniciarSesion(exe: string, usuario: string, password: string) {
  const vms = await AppEscritorio.abrir(exe);

  // Pantalla de login con el sistema de testing seleccionado
  await expect.poll(() => vms.textos(), { timeout: 30_000 }).toContain('INICIAR SESIÓN');
  const login = await vms.textos();
  expect(login.some((t) => t.startsWith(process.env.VMS_SISTEMA!)), `Sistema seleccionado: ${login}`).toBe(true);

  // Usuario y contraseña: los campos de texto 0 y 1 del formulario
  await vms.escribir(0, usuario);
  await vms.escribir(1, password);
  await vms.clic('INICIAR SESIÓN');
  return vms;
}

// Los logins fallidos van primero: como "Recordar" está tildado, la app guarda el último
// usuario escrito, y así termina recordando el usuario válido del login exitoso.
for (const app of APLICACIONES) {
  test.describe(app.nombre, () => {
    const casosInvalidos = [
      {
        id: `${app.prefijo}-LOGIN-02`,
        caso: 'usuario válido y contraseña incorrecta',
        usuario: () => process.env.VMS_USER!,
        mensaje: 'La contraseña es incorrecta',
      },
      {
        id: `${app.prefijo}-LOGIN-03`,
        caso: 'usuario y contraseña incorrectos',
        usuario: () => 'usuario-inexistente',
        mensaje: 'Cuenta de usuario inválida',
      },
    ];

    for (const caso of casosInvalidos) {
      test(`${caso.id} | Login en ${app.nombre} con ${caso.caso} muestra "${caso.mensaje}"`, async () => {
        test.setTimeout(2 * 60_000);
        const vms = await iniciarSesion(app.exe, caso.usuario(), `${process.env.VMS_PASSWORD}-incorrecta`);

        try {
          // El mensaje se dibuja debajo del botón y no es accesible: se lee con OCR
          await expect
            .poll(() => vms.leerPantalla(), { timeout: 30_000, intervals: [1_000] })
            .toContain(caso.mensaje);
          // Sigue en la pantalla de login
          expect(await vms.textos()).toContain('INICIAR SESIÓN');

          await test.info().attach(`${app.nombre}.png`, { body: await vms.captura(), contentType: 'image/png' });
        } finally {
          await vms.cerrar();
        }
      });
    }

    test(`${app.prefijo}-LOGIN-01 | Login en ${app.nombre} con el sistema ${process.env.VMS_SISTEMA}`, async () => {
      test.setTimeout(2 * 60_000);
      const vms = await iniciarSesion(app.exe, process.env.VMS_USER!, process.env.VMS_PASSWORD!);

      try {
        // Después del login la ventana muestra la pantalla principal de la aplicación
        await expect.poll(() => vms.textos(), { timeout: 60_000, intervals: [1_000] }).toEqual(
          expect.arrayContaining(app.textos)
        );
        expect(await vms.titulo()).toBe(app.titulo);
        expect(await vms.textos()).not.toContain('INICIAR SESIÓN');

        await test.info().attach(`${app.nombre}.png`, { body: await vms.captura(), contentType: 'image/png' });
      } finally {
        await vms.cerrar();
      }
    });
  });
}
