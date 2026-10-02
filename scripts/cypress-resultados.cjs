// Ejecuta Cypress con su API y guarda la duración de cada caso en el archivo indicado.
// Lo usa scripts/comparar.cjs.
const fs = require('fs');

delete process.env.ELECTRON_RUN_AS_NODE; // ver scripts/cypress.cjs
const cypress = require('cypress');

const salida = process.argv[2];

cypress.run({ browser: 'chrome' }).then((res) => {
  const casos = (res.runs ?? []).flatMap((run) =>
    run.tests.map((t) => {
      const titulo = t.title.at(-1);
      const [id, ...resto] = titulo.split(' | ');
      return {
        id: resto.length ? id.trim() : titulo,
        nombre: resto.length ? resto.join(' | ').trim() : titulo,
        ms: t.duration ?? t.attempts?.reduce((s, a) => s + (a.duration ?? 0), 0) ?? 0,
        paso: t.state === 'passed',
      };
    })
  );
  fs.writeFileSync(salida, JSON.stringify({ casos }));
});
