// Ejecuta Cypress quitando ELECTRON_RUN_AS_NODE: algunos editores (VS Code, Antigravity)
// la definen y hace que Cypress no arranque ("bad option: --smoke-test").
const { spawnSync } = require('child_process');

delete process.env.ELECTRON_RUN_AS_NODE;

const result = spawnSync(['npx', 'cypress', ...process.argv.slice(2)].join(' '), {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
