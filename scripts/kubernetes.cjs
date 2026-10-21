// Corre los tests de Playwright como Jobs de Kubernetes (el Kubernetes de Docker Desktop):
//
//   node scripts/kubernetes.cjs test       crea el Secret con el .env, lanza los Jobs de
//                                          k8s/tests.yaml en paralelo y muestra el resultado
//   node scripts/kubernetes.cjs limpiar    borra los Jobs y el Secret
//
// Antes: construir la imagen (npm run docker:build) y activar Kubernetes en Docker Desktop.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const JOBS = ['qa-tests-anpr', 'qa-tests-biblioteca'];
const accion = process.argv[2];

function kubectl(argumentos, { entrada, mostrar = true, permitirError = false } = {}) {
  const r = spawnSync('kubectl', argumentos, {
    cwd: raiz,
    input: entrada,
    encoding: 'utf8',
    stdio: [entrada ? 'pipe' : 'inherit', mostrar ? 'inherit' : 'pipe', mostrar ? 'inherit' : 'pipe'],
  });
  if (r.error) {
    console.error('No se encontró kubectl: activá Kubernetes en Docker Desktop y abrí una consola nueva.');
    process.exit(1);
  }
  if (r.status !== 0 && !permitirError) process.exit(r.status ?? 1);
  return r;
}

function limpiar() {
  kubectl(['delete', 'job', ...JOBS, '--ignore-not-found'], { permitirError: true });
  kubectl(['delete', 'secret', 'qa-env', '--ignore-not-found'], { permitirError: true });
}

if (accion === 'limpiar') {
  limpiar();
} else if (accion === 'test') {
  if (!fs.existsSync(path.join(raiz, '.env'))) {
    console.error('Falta el .env con las credenciales (ver .env.example).');
    process.exit(1);
  }
  kubectl(['config', 'current-context']);
  // Las credenciales como Secret de Kubernetes (se genera y se aplica sin dejar archivos)
  const secret = kubectl(['create', 'secret', 'generic', 'qa-env', '--from-env-file=.env', '--dry-run=client', '-o', 'yaml'], {
    mostrar: false,
  }).stdout;
  kubectl(['apply', '-f', '-'], { entrada: secret });
  // Cada ejecución empieza de cero: se borran los Jobs anteriores
  kubectl(['delete', 'job', ...JOBS, '--ignore-not-found']);
  kubectl(['apply', '-f', 'k8s/tests.yaml']);

  console.log('\nJobs corriendo en paralelo (un pod por producto):');
  kubectl(['get', 'pods', '-l', 'app=qa-tests']);
  // Se espera a que cada Job termine, bien o mal (como máximo 10 minutos)
  const estado = (job) =>
    kubectl(['get', 'job', job, '-o', 'jsonpath={.status.succeeded}/{.status.failed}'], { mostrar: false }).stdout;
  const resultado = {};
  const limite = Date.now() + 10 * 60_000;
  while (Object.keys(resultado).length < JOBS.length && Date.now() < limite) {
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)']);
    for (const job of JOBS.filter((j) => !resultado[j])) {
      const [ok, mal] = estado(job).split('/');
      if (ok === '1') resultado[job] = 'pasó';
      else if (mal && mal !== '0') resultado[job] = 'falló';
    }
  }
  for (const job of JOBS) {
    console.log(`\n===== ${job}: ${resultado[job] ?? 'no terminó a tiempo'} =====`);
    kubectl(['logs', `job/${job}`], { permitirError: true });
  }
  console.log('');
  kubectl(['get', 'jobs', '-l', 'app=qa-tests']);
  process.exit(JOBS.every((j) => resultado[j] === 'pasó') ? 0 : 1);
} else {
  console.error('Uso: node scripts/kubernetes.cjs test | limpiar');
  process.exit(1);
}
