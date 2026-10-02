// Ejecuta los tests de Selenium (Mocha). Con --headed se ve el navegador.
const { spawnSync } = require('child_process');

const headed = process.argv.includes('--headed');
const args = process.argv.slice(2).filter((a) => a !== '--headed');

const result = spawnSync(['npx', 'mocha', ...args].join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...(headed ? { SELENIUM_HEADED: '1' } : {}) },
});
process.exit(result.status ?? 1);
