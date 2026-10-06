// Levanta Jenkins en esta PC para la demo del workshop: http://localhost:8080
//
//   node scripts/jenkins.cjs
//
// Corre en la sesión del usuario y no como servicio de Windows: así los tests de VMS pueden
// abrir las aplicaciones de escritorio. Requiere Java 21. La primera vez descarga jenkins.war.
// Jobs, credenciales e historial quedan en %USERPROFILE%\.jenkins. Se detiene con Ctrl+C.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = path.join(os.homedir(), '.jenkins');
const WAR = path.join(HOME, 'jenkins.war');
const URL_WAR = 'https://get.jenkins.io/war-stable/latest/jenkins.war';

async function main() {
  if (spawnSync('java', ['-version']).error) {
    console.error('No se encontró Java. Instalalo con:');
    console.error('  winget install EclipseAdoptium.Temurin.21.JDK');
    console.error('y abrí una consola nueva.');
    process.exit(1);
  }

  if (!fs.existsSync(WAR)) {
    console.log('Descargando Jenkins (unos 100 MB)...');
    const r = await fetch(URL_WAR);
    if (!r.ok) {
      console.error(`No se pudo descargar Jenkins: ${r.status} ${r.statusText}`);
      process.exit(1);
    }
    fs.mkdirSync(HOME, { recursive: true });
    fs.writeFileSync(`${WAR}.part`, Buffer.from(await r.arrayBuffer()));
    fs.renameSync(`${WAR}.part`, WAR);
  }

  const inicial = path.join(HOME, 'secrets', 'initialAdminPassword');
  console.log('Jenkins en http://localhost:8080 (Ctrl+C para detenerlo)');
  if (!fs.existsSync(path.join(HOME, 'config.xml'))) {
    console.log(`La primera vez pide la contraseña inicial: está en ${inicial}`);
  }

  // Sin CSP para que el reporte HTML de Playwright funcione dentro de Jenkins (solo para la demo local)
  const jenkins = spawn('java', ['-Dhudson.model.DirectoryBrowserSupport.CSP=', '-jar', WAR, '--httpPort=8080'], {
    stdio: 'inherit',
  });
  jenkins.on('exit', (codigo) => process.exit(codigo ?? 0));
}

main();
