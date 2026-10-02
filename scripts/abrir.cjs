// Abre un archivo (por ejemplo un reporte HTML) con el programa predeterminado del sistema.
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const archivo = path.resolve(process.argv[2]);
if (!fs.existsSync(archivo)) {
  console.error(`No existe ${archivo}. Primero ejecutá los tests.`);
  process.exit(1);
}

const comando =
  process.platform === 'win32' ? `start "" "${archivo}"`
  : process.platform === 'darwin' ? `open "${archivo}"`
  : `xdg-open "${archivo}"`;
exec(comando);
