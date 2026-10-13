import { expect, Page } from '@playwright/test';

/**
 * pgAdmin (la web para consultar la base): muestra en pantalla una consulta a la base de ANPR,
 * como la haría una persona. Solo sirve para que se vea: lo que se verifica lo consulta bd.ts.
 *
 * La cuenta de pgAdmin es compartida y pgAdmin guarda las pestañas abiertas: siempre se cierra
 * la pestaña que se abre, sin guardar.
 */

// Servidor y base, tal como aparecen en el árbol de pgAdmin
const RUTA = ['Servers', 'TESTING', 'Databases', 'ANPR'];

export const hayPgAdmin = () => !!process.env.PGADMIN_URL && !!process.env.PGADMIN_USER;

/** Nodo del árbol (Object Explorer) por nombre y nivel; el nombre puede tener la cantidad: "Databases (12)" */
function nodo(page: Page, nombre: string, nivel: number) {
  return page.locator(`.file-entry.depth-${nivel}`).filter({
    has: page.locator('.file-name', { hasText: new RegExp(`^${nombre}(\\(\\d+\\))?$`) }),
  });
}

/** Abre el árbol hasta la base. pgAdmin recuerda lo que estaba abierto: solo se expande lo que falta. */
async function abrirBase(page: Page) {
  for (let i = 1; i < RUTA.length; i++) {
    const hijo = nodo(page, RUTA[i], i + 1);
    const visible = await hijo.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false
    );
    if (!visible) {
      await nodo(page, RUTA[i - 1], i).locator('.directory-toggle').click();
      await hijo.waitFor({ timeout: 30_000 });
    }
  }
  await nodo(page, RUTA.at(-1)!, RUTA.length).click();
}

/** Entra a pgAdmin, abre el Query Tool de ANPR, ejecuta la consulta y deja el resultado en pantalla */
export async function mostrarEnPgAdmin(page: Page, sql: string, pausa = 8_000) {
  await page.goto(process.env.PGADMIN_URL!);
  await page.locator('input[name="email"]').fill(process.env.PGADMIN_USER!);
  await page.locator('input[name="password"]').fill(process.env.PGADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Servers', { exact: true })).toBeVisible({ timeout: 30_000 });
  await abrirBase(page);

  // Tools → Query Tool abre una pestaña nueva; cada pestaña es un iframe (/sqleditor/panel/<id>)
  const pestanas = page.locator('.dock-tab').filter({ hasText: /^ANPR\/admin@/ });
  const anteriores = await pestanas.evaluateAll((ps) => ps.map((p) => p.getAttribute('data-node-key')));
  await page.getByText('Tools', { exact: true }).click();
  await page.getByRole('menuitem', { name: /^Query Tool/ }).click();
  await expect(pestanas).toHaveCount(anteriores.length + 1, { timeout: 30_000 });
  const clave = (await pestanas.evaluateAll((ps) => ps.map((p) => p.getAttribute('data-node-key')))).find(
    (c) => !anteriores.includes(c)
  )!;
  const nueva = page.locator(`.dock-tab[data-node-key="${clave}"]`);
  const panel = clave.split('_').at(-1);
  await expect.poll(() => page.frames().some((f) => f.url().includes(`/panel/${panel}?`))).toBe(true);
  const editor = page.frames().find((f) => f.url().includes(`/panel/${panel}?`))!;

  try {
    await editor.locator('.cm-content').click();
    await page.keyboard.insertText(sql);
    await page.keyboard.press('F5');
    await expect(editor.locator('[role="gridcell"]').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(pausa);
    return await page.screenshot();
  } finally {
    // Se cierra sin guardar la consulta (el aviso aparece dentro del iframe de la pestaña)
    await nueva.locator('button').last().click();
    const noGuardar = editor.locator('button', { hasText: /Don.t save/ });
    if (await noGuardar.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await noGuardar.click();
    await expect(pestanas).toHaveCount(anteriores.length);
  }
}
