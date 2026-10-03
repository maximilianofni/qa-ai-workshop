// Ejecuta la test suite de Katalon por consola (katalonc), sin abrir el IDE.
// Usuario, contraseña y API key se toman del .env y se pasan a Katalon al ejecutar,
// así no quedan guardados en el proyecto de Katalon.
//
//   node scripts/katalon.cjs             Chrome sin ventana
//   node scripts/katalon.cjs --headed    Chrome visible
//   node scripts/katalon.cjs --reporte   Abre el último reporte HTML (también los del IDE)
//
// La ejecución por consola requiere licencia de Katalon Runtime Engine (KRE).
// Sin licencia, Katalon muestra un aviso y no ejecuta: correr la suite desde el IDE.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(RAIZ, '.env'), quiet: true });

const PROYECTO = path.join(RAIZ, 'katalon', 'ANPR.prj');
const REPORTES = path.join(RAIZ, 'katalon', 'Reports', 'ultimo');
const SUITE = 'Test Suites/ANPR - Login';

// katalonc.exe: KATALONC_PATH del .env, o la última versión instalada en ~/.katalon/packages
function buscarKatalonc() {
  if (process.env.KATALONC_PATH) return process.env.KATALONC_PATH;
  const paquetes = path.join(os.homedir(), '.katalon', 'packages');
  const versiones = fs.existsSync(paquetes)
    ? fs.readdirSync(paquetes).filter((d) => fs.existsSync(path.join(paquetes, d, 'katalonc.exe'))).sort()
    : [];
  if (!versiones.length) {
    console.error('No se encontró katalonc.exe. Indicá la ruta en el .env con KATALONC_PATH=...');
    process.exit(1);
  }
  return path.join(paquetes, versiones.at(-1), 'katalonc.exe');
}

if (process.argv.includes('--reporte')) {
  const htmls = [];
  const buscar = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) buscar(ruta);
      else if (e.name.endsWith('.html')) htmls.push(ruta);
    }
  };
  buscar(path.join(RAIZ, 'katalon', 'Reports'));
  const ultimo = htmls.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs).at(-1);
  if (!ultimo) {
    console.error('No hay reportes de Katalon. Primero ejecutá la suite.');
    process.exit(1);
  }
  const r = spawnSync('node', [path.join(__dirname, 'abrir.cjs'), ultimo], { stdio: 'inherit' });
  process.exit(r.status ?? 0);
}

console.log('Katalon por consola requiere licencia de Katalon Runtime Engine (KRE).');

const faltan = ['BASE_URL', 'APP_USER', 'APP_PASSWORD', 'KATALON_API_KEY'].filter((v) => !process.env[v]);
if (faltan.length) {
  console.error(`Faltan variables en el .env: ${faltan.join(', ')}`);
  process.exit(1);
}

const headed = process.argv.includes('--headed');
fs.rmSync(REPORTES, { recursive: true, force: true });

const args = [
  '-noSplash',
  '-runMode=console',
  `-projectPath=${PROYECTO}`,
  `-testSuitePath=${SUITE}`,
  `-browserType=${headed ? 'Chrome' : 'Chrome (headless)'}`,
  '-executionProfile=default',
  '-retry=0',
  `-reportFolder=${REPORTES}`,
  '-reportFileName=index',
  `-apiKey=${process.env.KATALON_API_KEY}`,
  `-g_BASE_URL=${process.env.BASE_URL}`,
  `-g_APP_USER=${process.env.APP_USER}`,
  `-g_APP_PASSWORD=${process.env.APP_PASSWORD}`,
];

const result = spawnSync(buscarKatalonc(), args, { stdio: 'inherit', cwd: RAIZ });
process.exit(result.status ?? 1);
