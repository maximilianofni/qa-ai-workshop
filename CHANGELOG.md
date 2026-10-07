# Changelog

Todos los cambios relevantes del proyecto se registran en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado
- **Biblioteca Digital** en Playwright: BD-SMOKE-01, BD-LOGIN-01, BD-LOGIN-02, BD-LOGIN-03 y
  BD-LOGOUT-01, con credenciales tomadas del `.env` (`BD_BASE_URL`, `BD_USER`, `BD_PASSWORD`).
- Comandos `test:anpr` y `test:bd` para correr un solo producto.
- README: problemas comunes de `npm` en Windows (comando no reconocido y política de ejecución).
- **AS** (servidor de analíticas) por SSH: AS-INSTALL-01, AS-ANPR-01 y AS-UNINSTALL-01, con el
  acceso tomado del `.env` (`AS_HOST`, `AS_USER`, `AS_PASSWORD`, `AS_DIR`). Comandos `test:as` y
  `test:as:headed`.
- **VMS** (aplicaciones de escritorio WinForms) con UI Automation y OCR de Windows: login correcto,
  contraseña incorrecta y usuario inválido en Control Center y Configurator (VMS-CC-LOGIN-01/02/03 y
  VMS-CFG-LOGIN-01/02/03). Comando `test:vms`.
- **Jenkins**: `Jenkinsfile` con una etapa por producto, credenciales de Jenkins y un reporte HTML
  por producto. Comando `jenkins` para levantarlo en la PC de la demo.
- README: comparación entre GitHub Actions y Jenkins, y cómo preparar una PC Windows como agente
  para correr VMS en la empresa.

### Cambiado
- Los tests de ANPR en Playwright pasan a `tests/anpr/`: cada producto tiene su carpeta.
- Playwright usa un proyecto por producto (`anpr` y `biblioteca-digital`), cada uno con su URL.
- La comparación de herramientas corre solo los casos de ANPR.
- `package.json` habilita los scripts de instalación de Cypress y esbuild (requerido por npm 11).

### Corregido
- VMS: la captura y el OCR leían la ventana que estuviera encima (por ejemplo el navegador con
  Jenkins); ahora se captura la ventana de VMS directamente.
- VMS: el botón de login no respondía si la ventana no estaba activa (al correr desde Jenkins);
  ahora la ventana pasa al frente antes de hacer clic.

## [1.4.0] - 2026-10-02

### Agregado
- Casos de ANPR (SMOKE-01, LOGIN-01, LOGIN-02, LOGIN-03, LOGOUT-01) en **Katalon Studio**,
  con credenciales tomadas del `.env`.
- Comandos `ka:run`, `ka:headed` (requieren licencia KRE) y `ka:report`.
- Katalon en la comparación de herramientas, a partir del último reporte del IDE.
- README: tabla de criterios entre herramientas (licencia, adaptaciones, reportes).

### Cambiado
- Comparación de herramientas: horas en formato de 24 horas.

## [1.3.0] - 2026-10-02

### Agregado
- Casos de ANPR (SMOKE-01, LOGIN-01, LOGIN-02, LOGIN-03, LOGOUT-01) en **Cypress** y **Selenium**.
- Reportes HTML de Cypress y Selenium (`npm run cy:report`, `npm run se:report`).
- Reporte HTML de comparación de tiempos entre herramientas, con historial (`npm run comparar`).
- Validación en CI de los tests de las tres herramientas.

### Cambiado
- README: el proyecto se presenta como multi-herramienta; flujo de trabajo QA + agente de IA y
  criterios de revisión de tests generados por IA.
- Plantilla de requerimiento: campo **Herramienta** y resumen ejecutivo para la líder del equipo.
- Node.js 22 como versión mínima.

## [1.2.0] - 2026-10-02

### Agregado
- LOGIN-02: login con contraseña incorrecta muestra el mensaje de error exacto y no permite el ingreso.
- LOGIN-03: login con campos vacíos muestra el mensaje de error exacto.
- Plantilla de prompt por requerimiento en `prompts/`, con reporte de casos y resumen para la líder.
- Guía para crear el pipeline de CI con IA.
- README: qué es Antigravity, flujo de trabajo del tester con IA y tablero de seguimiento.

## [1.1.0] - 2026-10-02

### Agregado
- README con instalación, ejecución, CI, versiones y convención de commits.
- Documento [Antigravity aplicado a QA y Testing](docs/antigravity-para-testing.md).
- Pipeline de CI: validación de tests en GitHub y tests end-to-end en runner interno.
- Pipeline de release automática al subir un tag `vX.Y.Z`.

## [1.0.0] - 2026-10-02

### Agregado
- Configuración de Playwright para Chrome, con evidencias (captura, video y traza) en fallas.
- SMOKE-01: la página de login abre en Chrome.
- LOGIN-01: login exitoso con usuario válido.
- LOGOUT-01: cerrar sesión vuelve al login y bloquea el acceso al panel.

[1.4.0]: https://github.com/maximilianofni/qa-ai-workshop/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/maximilianofni/qa-ai-workshop/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/maximilianofni/qa-ai-workshop/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/maximilianofni/qa-ai-workshop/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/maximilianofni/qa-ai-workshop/releases/tag/v1.0.0
