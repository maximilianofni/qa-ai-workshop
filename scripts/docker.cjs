// Corre los tests de Playwright dentro de un contenedor Docker:
//
//   node scripts/docker.cjs build            construye la imagen qa-ai-workshop-tests
//   node scripts/docker.cjs test [args]      corre los tests (por defecto, ANPR y Biblioteca Digital)
//
// Ejemplo: node scripts/docker.cjs test --project=anpr
// Las credenciales salen del .env y no quedan en la imagen. El reporte HTML queda en
// playwright-report/docker. VMS no corre en Docker: necesita el escritorio de Windows.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const IMAGEN = 'qa-ai-workshop-tests';
const raiz = path.resolve(__dirname, '..');
const [accion, ...args] = process.argv.slice(2);

function docker(...argumentos) {
  const r = spawnSync('docker', argumentos, { stdio: 'inherit', cwd: raiz });
  if (r.error) {
    console.error('No se encontró Docker: instalá Docker Desktop y abrí una consola nueva.');
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}

if (accion === 'build') {
  docker('build', '-t', IMAGEN, '.');
} else if (accion === 'test') {
  if (!fs.existsSync(path.join(raiz, '.env'))) {
    console.error('Falta el .env con las credenciales (ver .env.example).');
    process.exit(1);
  }
  const reporte = path.join(raiz, 'playwright-report', 'docker');
  fs.mkdirSync(reporte, { recursive: true });
  const comando = args.length ? ['npx', 'playwright', 'test', ...args] : [];
  docker('run', '--rm', '--env-file', '.env', '-v', `${reporte}:/qa/playwright-report`, IMAGEN, ...comando);
} else {
  console.error('Uso: node scripts/docker.cjs build | test [argumentos de playwright]');
  process.exit(1);
}
