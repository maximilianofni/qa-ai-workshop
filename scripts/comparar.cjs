// Ejecuta los mismos casos en cada herramienta, mide los tiempos y genera
// reports/comparacion.html (con historial en reports/historial.json).
//
// Para sumar una herramienta nueva (por ejemplo JMeter), agregar un bloque en HERRAMIENTAS
// con una función que devuelva { casos: [{ id, nombre, ms, paso }] }.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SALIDA = path.join(RAIZ, 'reports');
const TMP = path.join(SALIDA, '.tmp');
const HISTORIAL = path.join(SALIDA, 'historial.json');
const MAX_HISTORIAL = 20;

// "LOGIN-01 | Login exitoso..." -> { id: 'LOGIN-01', nombre: 'Login exitoso...' }
function separarTitulo(titulo) {
  const [id, ...resto] = titulo.split(' | ');
  return resto.length ? { id: id.trim(), nombre: resto.join(' | ').trim() } : { id: titulo, nombre: titulo };
}

function ejecutar(comando, args, env = {}) {
  const r = spawnSync([comando, ...args].join(' '), {
    cwd: RAIZ,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return r.status;
}

const HERRAMIENTAS = [
  {
    id: 'playwright',
    nombre: 'Playwright',
    correr() {
      const archivo = path.join(TMP, 'playwright.json');
      // Solo login y smoke: son los casos que también están en Cypress, Selenium y Katalon
      ejecutar('npx', ['playwright', 'test', '--project=anpr', 'login', 'smoke', '--workers=1', '--reporter=json'], {
        PLAYWRIGHT_JSON_OUTPUT_FILE: archivo,
      });
      const json = JSON.parse(fs.readFileSync(archivo, 'utf-8'));
      const casos = [];
      const recorrer = (suite) => {
        for (const spec of suite.specs ?? []) {
          const resultado = spec.tests[0]?.results.at(-1);
          casos.push({ ...separarTitulo(spec.title), ms: resultado?.duration ?? 0, paso: spec.ok });
        }
        (suite.suites ?? []).forEach(recorrer);
      };
      json.suites.forEach(recorrer);
      return { casos };
    },
  },
  {
    id: 'cypress',
    nombre: 'Cypress',
    correr() {
      const archivo = path.join(TMP, 'cypress.json');
      ejecutar('node', ['scripts/cypress-resultados.cjs', `"${archivo}"`]);
      return JSON.parse(fs.readFileSync(archivo, 'utf-8'));
    },
  },
  {
    id: 'selenium',
    nombre: 'Selenium',
    correr() {
      ejecutar('npx', ['mocha']);
      const json = JSON.parse(fs.readFileSync(path.join(RAIZ, 'selenium', 'reports', 'index.json'), 'utf-8'));
      const casos = [];
      const recorrer = (suite) => {
        for (const t of suite.tests ?? []) {
          casos.push({ ...separarTitulo(t.title), ms: t.duration ?? 0, paso: t.pass });
        }
        (suite.suites ?? []).forEach(recorrer);
      };
      json.results.forEach(recorrer);
      return { casos };
    },
  },
  {
    id: 'katalon',
    nombre: 'Katalon',
    // La ejecución por consola (katalonc) requiere licencia paga de Katalon Runtime Engine.
    // Mientras no haya licencia, se toma el último reporte ejecutado desde el IDE.
    leerUltimoReporte() {
      const reportes = [];
      const buscar = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const ruta = path.join(dir, e.name);
          if (e.isDirectory()) buscar(ruta);
          else if (e.name === 'JUnit_Report.xml') reportes.push(ruta);
        }
      };
      buscar(path.join(RAIZ, 'katalon', 'Reports'));
      const ultimo = reportes.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs).at(-1);
      if (!ultimo) return null;

      const xml = fs.readFileSync(ultimo, 'utf-8');
      const casos = [...xml.matchAll(/<testcase name="([^"]+)" time="([\d.]+)"[^>]*status="(\w+)"/g)].map(([, titulo, seg, estado]) => {
        const nombre = titulo.replace(/^Test Cases\/(?:[^/]+\/)*/, '');
        const [, id, resto] = nombre.match(/^([A-Z]+-\d+)\s*-\s*(.*)$/) ?? [null, nombre, nombre];
        return { id, nombre: resto, ms: Math.round(Number(seg) * 1000), paso: estado === 'PASSED' };
      });
      const totalMs = Math.round(Number(xml.match(/<testsuites[^>]* time="([\d.]+)"/)?.[1] ?? 0) * 1000);
      const fecha = new Date(xml.match(/timestamp="([^"]+)"/)?.[1] ?? fs.statSync(ultimo).mtime);
      return {
        casos,
        totalMs,
        nota: `ejecutado desde el IDE el ${fecha.toLocaleString('es-AR', { hour12: false })} (por consola requiere licencia paga). `
          + 'No incluye el arranque de Katalon; cada caso incluye abrir Chrome.',
      };
    },
  },
];

// ---------------------------------------------------------------------------

function medir(herramienta) {
  let casos, totalMs, nota;
  if (herramienta.leerUltimoReporte) {
    console.log(`\n▶ Leyendo el último reporte de ${herramienta.nombre}...\n`);
    const reporte = herramienta.leerUltimoReporte();
    if (!reporte) {
      console.log(`  No hay reportes de ${herramienta.nombre}; se omite.`);
      return null;
    }
    ({ casos, totalMs, nota } = reporte);
  } else {
    console.log(`\n▶ Ejecutando ${herramienta.nombre}...\n`);
    const inicio = Date.now();
    ({ casos } = herramienta.correr());
    totalMs = Date.now() - inicio;
  }
  const testsMs = casos.reduce((s, c) => s + c.ms, 0);
  return {
    id: herramienta.id,
    nombre: herramienta.nombre,
    totalMs,
    testsMs,
    preparacionMs: Math.max(totalMs - testsMs, 0),
    pasaron: casos.filter((c) => c.paso).length,
    total: casos.length,
    casos,
    nota,
  };
}

const seg = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function generarHtml(corrida, historial) {
  const { fecha, resultados } = corrida;
  const maxMs = Math.max(...resultados.map((r) => r.totalMs));
  const ordenados = [...resultados].sort((a, b) => a.totalMs - b.totalMs);
  const masRapida = ordenados[0];
  const masLenta = ordenados.at(-1);
  const factor = masLenta.totalMs / masRapida.totalMs;

  const tiles = resultados.map((r) => `
    <div class="tile">
      <div class="tile-label">${esc(r.nombre)}${r.nota ? ' *' : ''}</div>
      <div class="tile-value">${seg(r.totalMs)}</div>
      <div class="tile-sub">${r.pasaron} de ${r.total} casos pasaron${r.pasaron < r.total ? ' <span class="fail">✗ hay fallas</span>' : ''}</div>
    </div>`).join('');

  const notas = resultados.filter((r) => r.nota)
    .map((r) => `<p class="note">* <strong>${esc(r.nombre)}</strong>: ${esc(r.nota)}</p>`).join('');

  const barras = resultados.map((r) => {
    const pTests = (r.testsMs / maxMs) * 100;
    const pPrep = (r.preparacionMs / maxMs) * 100;
    return `
    <div class="bar-row">
      <div class="bar-name">${esc(r.nombre)}${r.nota ? ' *' : ''}</div>
      <div class="bar-track">
        <div class="seg seg-tests" style="width:${pTests}%" data-tip="${esc(r.nombre)} · Tests: ${seg(r.testsMs)}"></div>
        <div class="seg seg-prep" style="width:${pPrep}%" data-tip="${esc(r.nombre)} · Preparación: ${seg(r.preparacionMs)}"></div>
        <div class="bar-total">${seg(r.totalMs)}</div>
      </div>
    </div>`;
  }).join('');

  const ids = [...new Set(resultados.flatMap((r) => r.casos.map((c) => c.id)))];
  const filasCasos = ids.map((id) => {
    const nombre = resultados.flatMap((r) => r.casos).find((c) => c.id === id)?.nombre ?? '';
    const celdas = resultados.map((r) => {
      const c = r.casos.find((x) => x.id === id);
      if (!c) return '<td class="num muted">—</td>';
      return `<td class="num">${seg(c.ms)} ${c.paso ? '<span class="ok">✓</span>' : '<span class="fail">✗ Falló</span>'}</td>`;
    }).join('');
    return `<tr><td><strong>${esc(id)}</strong></td><td>${esc(nombre)}</td>${celdas}</tr>`;
  }).join('');

  const filasResumen = resultados.map((r) => `
    <tr><td><strong>${esc(r.nombre)}</strong></td><td class="num">${seg(r.preparacionMs)}</td>
    <td class="num">${seg(r.testsMs)}</td><td class="num"><strong>${seg(r.totalMs)}</strong></td>
    <td class="num">${r.pasaron} / ${r.total}</td></tr>`).join('');

  const herramientasHist = [...new Set(historial.flatMap((h) => h.resultados.map((r) => r.nombre)))];
  const filasHist = [...historial].reverse().map((h) => `
    <tr><td>${esc(new Date(h.fecha).toLocaleString('es-AR', { hour12: false }))}</td>${herramientasHist.map((n) => {
      const r = h.resultados.find((x) => x.nombre === n);
      return `<td class="num">${r ? seg(r.totalMs) : '—'}</td>`;
    }).join('')}</tr>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparación de herramientas</title>
<style>
  :root {
    color-scheme: light;
    --surface-0: #f4f4f2; --surface-1: #fcfcfb; --border: #e2e1dc;
    --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #7a7974;
    --series-1: #2a78d6; --series-2: #eb6834;
    --good: #0a7a32; --critical: #c62828;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-0: #111110; --surface-1: #1a1a19; --border: #2e2e2c;
      --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #8f8e86;
      --series-1: #3987e5; --series-2: #d95926;
      --good: #4cc27a; --critical: #ef6b6b;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-0: #111110; --surface-1: #1a1a19; --border: #2e2e2c;
    --text-primary: #ffffff; --text-secondary: #c3c2b7; --text-muted: #8f8e86;
    --series-1: #3987e5; --series-2: #d95926;
    --good: #4cc27a; --critical: #ef6b6b;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--surface-0); color: var(--text-primary);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 0 0 12px; }
  .meta { color: var(--text-secondary); margin: 0 0 24px; }
  .card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
    padding: 20px; margin-bottom: 20px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .tile { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .tile-label { color: var(--text-secondary); font-size: 13px; }
  .tile-value { font-size: 32px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .tile-sub { color: var(--text-secondary); font-size: 13px; }
  .headline { font-size: 16px; margin: 0 0 16px; }
  .legend { display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
  .legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px;
    margin-right: 6px; vertical-align: -1px; background: var(--c); }
  .bar-row { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 12px; margin: 10px 0; }
  .bar-name { color: var(--text-secondary); font-size: 14px; }
  .bar-track { display: flex; align-items: center; gap: 2px; height: 28px; padding-right: 64px; position: relative; }
  .seg { height: 100%; min-width: 2px; cursor: default; }
  .seg-tests { background: var(--series-1); border-radius: 0; }
  .seg-prep { background: var(--series-2); border-radius: 0 4px 4px 0; }
  .seg:hover { filter: brightness(1.1); }
  .bar-total { margin-left: 8px; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .note { color: var(--text-muted); font-size: 13px; margin: 12px 0 0; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--text-secondary); font-weight: 500; font-size: 13px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ok { color: var(--good); }
  .fail { color: var(--critical); font-weight: 600; }
  .muted { color: var(--text-muted); }
  td:first-child { white-space: nowrap; }
  #tip { position: fixed; pointer-events: none; background: var(--text-primary); color: var(--surface-1);
    padding: 6px 10px; border-radius: 6px; font-size: 13px; opacity: 0; transition: opacity .1s; }
  @media (max-width: 560px) { .bar-row { grid-template-columns: 1fr; gap: 4px; } }
</style>
</head>
<body>
<main>
  <h1>Comparación de herramientas – ANPR</h1>
  <p class="meta">Ejecución del ${esc(new Date(fecha).toLocaleString('es-AR', { hour12: false }))} · mismos casos, mismo Chrome, sin ventana visible, un test por vez.</p>

  <div class="tiles">${tiles}</div>

  <section class="card">
    <h2>Tiempo total de ejecución</h2>
    <p class="headline">${resultados.length > 1
      ? `<strong>${esc(masRapida.nombre)}</strong> fue la más rápida: ${factor.toFixed(1).replace('.', ',')} veces más rápida que ${esc(masLenta.nombre)}.`
      : `Total: <strong>${seg(masRapida.totalMs)}</strong>.`}</p>
    <div class="legend">
      <span style="--c: var(--series-1)">Tests (ejecución de los casos)</span>
      <span style="--c: var(--series-2)">Preparación (arrancar la herramienta y el navegador)</span>
    </div>
    ${barras}
    <p class="note">Pasá el mouse sobre cada parte de la barra para ver el detalle.</p>
    ${notas}
  </section>

  <section class="card">
    <h2>Resumen</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Herramienta</th><th class="num">Preparación</th><th class="num">Tests</th><th class="num">Total</th><th class="num">Pasaron</th></tr></thead>
      <tbody>${filasResumen}</tbody>
    </table></div>
  </section>

  <section class="card">
    <h2>Tiempo por caso</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Caso</th>${resultados.map((r) => `<th class="num">${esc(r.nombre)}</th>`).join('')}</tr></thead>
      <tbody>${filasCasos}</tbody>
    </table></div>
  </section>

  <section class="card">
    <h2>Historial de ejecuciones (tiempo total)</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Fecha</th>${herramientasHist.map((n) => `<th class="num">${esc(n)}</th>`).join('')}</tr></thead>
      <tbody>${filasHist}</tbody>
    </table></div>
  </section>
</main>
<div id="tip" role="tooltip"></div>
<script>
  const tip = document.getElementById('tip');
  document.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      tip.textContent = el.dataset.tip;
      tip.style.left = e.clientX + 12 + 'px';
      tip.style.top = e.clientY + 12 + 'px';
      tip.style.opacity = 1;
    });
    el.addEventListener('mouseleave', () => { tip.style.opacity = 0; });
  });
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------

fs.mkdirSync(TMP, { recursive: true });

const resultados = HERRAMIENTAS.map(medir).filter(Boolean);
const corrida = { fecha: new Date().toISOString(), resultados };

let historial = [];
try { historial = JSON.parse(fs.readFileSync(HISTORIAL, 'utf-8')); } catch {}
historial.push({ fecha: corrida.fecha, resultados: resultados.map(({ nombre, totalMs }) => ({ nombre, totalMs })) });
historial = historial.slice(-MAX_HISTORIAL);
fs.writeFileSync(HISTORIAL, JSON.stringify(historial, null, 2));

const html = path.join(SALIDA, 'comparacion.html');
fs.writeFileSync(html, generarHtml(corrida, historial));
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n════════ Comparación ════════');
for (const r of resultados) {
  console.log(`${r.nombre.padEnd(12)} total ${seg(r.totalMs).padStart(8)}  (tests ${seg(r.testsMs)}, preparación ${seg(r.preparacionMs)})  ${r.pasaron}/${r.total} pasaron`);
}
console.log(`\nReporte: ${html}`);
