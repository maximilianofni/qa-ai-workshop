# QA AI Workshop – Automatización de pruebas con agentes de IA

Automatización de pruebas end-to-end de los sistemas de la organización, desarrollada con un
**agente de inteligencia artificial** bajo la dirección y revisión del equipo de QA.

El proyecto implementa **los mismos casos de prueba en distintas herramientas de
automatización** para compararlas en condiciones reales, empezando por la aplicación
**ANPR (UltraIP)**.

## Herramientas

| Herramienta | Tipo de prueba | Carpeta | Estado |
|---|---|---|---|
| [Playwright](https://playwright.dev/) | Funcional (navegador) | [tests/](tests/) | ✅ Implementada |
| [Cypress](https://www.cypress.io/) | Funcional (navegador) | [cypress/e2e/](cypress/e2e/) | ✅ Implementada |
| [Selenium](https://www.selenium.dev/) | Funcional (navegador) | [selenium/tests/](selenium/tests/) | ✅ Implementada |
| [Katalon](https://katalon.com/) | Funcional (herramienta visual) | [katalon/](katalon/) | ✅ Implementada (ejecución desde el IDE) |
| [JMeter](https://jmeter.apache.org/) | Carga y rendimiento | — | 🕒 Planificada |

## Agente de IA: Antigravity

**Antigravity** es un entorno de desarrollo de Google con un **agente de IA** integrado. A
diferencia de un asistente de chat, el agente **ejecuta tareas**:

- **Explora** la aplicación en el navegador para identificar campos, botones y mensajes.
- **Escribe** el código de los tests en la herramienta indicada.
- **Ejecuta** los tests y reporta los resultados.
- **Deja evidencia** (capturas, grabaciones y plan de trabajo) para la revisión del equipo.

> Explicación para áreas no técnicas: [Antigravity aplicado a QA y Testing](docs/antigravity-para-testing.md).

## Flujo de trabajo: QA + agente de IA

El equipo de QA define **qué** se prueba y **cuál** es el resultado esperado; el agente se
encarga de la implementación. Ningún test se incorpora sin revisión del equipo de QA.

| Paso | Responsable | Actividad |
|---|---|---|
| 1. Diseño del caso | QA | Definición de ID, precondiciones, pasos y resultado esperado |
| 2. Registro | QA | Alta del caso en el [tablero de seguimiento](#tablero-de-seguimiento) en **Todo** |
| 3. Solicitud | QA → Agente | Se completa la [plantilla de requerimiento](prompts/plantilla-requerimiento.md) y se adjunta al agente |
| 4. Implementación | Agente | Exploración de la aplicación, desarrollo y ejecución de los tests |
| 5. Revisión | QA | Ejecución supervisada y validación de que el test cubre el resultado esperado |
| 6. Integración | QA | Commit con `Closes #N`; el caso pasa automáticamente a **Done** |

### Criterios de revisión de tests generados por IA

- El test valida el **resultado esperado** del caso, no solo la carga de la página.
- El test **falla** ante un comportamiento incorrecto (por ejemplo, una contraseña inválida).
- No hay credenciales en el código: se toman siempre de `.env`.
- El ID y el nombre del test coinciden con el caso del tablero.

### Plantilla de requerimiento

Cada requerimiento se documenta como un archivo en [prompts/](prompts/) y se adjunta al agente:

| Archivo | Uso |
|---|---|
| [prompts/plantilla-requerimiento.md](prompts/plantilla-requerimiento.md) | Plantilla base para cada requerimiento nuevo |
| [prompts/LOGIN-02.md](prompts/LOGIN-02.md) | Ejemplo: login con credenciales inválidas |

Por cada requerimiento el agente entrega: archivos modificados, comandos de ejecución, reporte
de casos, explicación funcional de cada test y un **resumen ejecutivo para la líder del equipo**.

> Para crear el pipeline de CI con IA, ver [Guía: crear el CI con IA](docs/guia-ci-con-ia.md).

## Casos automatizados – ANPR

| ID | Caso | Playwright | Cypress | Selenium | Katalon | Issue |
|---|---|---|---|---|---|---|
| SMOKE-01 | La página de login abre en Chrome | ✅ | ✅ | ✅ | ✅ | #1 |
| LOGIN-01 | Login exitoso con usuario válido | ✅ | ✅ | ✅ | ✅ | #2 |
| LOGIN-02 | Login con contraseña incorrecta muestra el mensaje de error exacto | ✅ | ✅ | ✅ | ✅ | #4 |
| LOGIN-03 | Login con campos vacíos muestra el mensaje de error exacto | ✅ | ✅ | ✅ | ✅ | #4 |
| LOGOUT-01 | Cerrar sesión vuelve al login y bloquea el acceso al panel | ✅ | ✅ | ✅ | ✅ | #3 |

## Casos automatizados – Biblioteca Digital

Biblioteca Digital no tiene login propio: al entrar redirige al **autenticador** de UltraIP
(`authenticator.testing.deploy.danaide.com.ar`), y después del login vuelve a la app.

| ID | Caso | Playwright | Cypress | Selenium | Katalon |
|---|---|---|---|---|---|
| BD-SMOKE-01 | La app redirige al login del autenticador | ✅ | – | – | – |
| BD-LOGIN-01 | Login exitoso con usuario válido | ✅ | – | – | – |
| BD-LOGIN-02 | Login con contraseña incorrecta muestra la alerta "Error" con "Usuario o contraseña inválidos" | ✅ | – | – | – |
| BD-LOGIN-03 | Login con campos vacíos muestra "Este campo es requerido" debajo de cada campo | ✅ | – | – | – |
| BD-LOGOUT-01 | Cerrar sesión vuelve al login y la app vuelve a pedir credenciales | ✅ | – | – | – |

## Casos automatizados – AS (servidor de analíticas)

AS no es una aplicación web: se instala en una máquina virtual Linux (`10.150.2.165`) con un
instalador `.sh` que baja la imagen de Docker. Los tests usan Playwright como *test runner* y
se conectan por **SSH** (librería `ssh2`), igual que a mano con PuTTY: ejecutan los comandos y
validan la salida de la consola y los archivos que quedan en `logs/`. Corren en orden:

| ID | Caso | Qué valida |
|---|---|---|
| AS-INSTALL-01 | Instalación con la analítica de ANPR (`installer2.4-rc1.sh ... -i`) | La salida termina con `Installation complete.` y el servicio `uip-analytics-server` queda `active` |
| AS-ANPR-01 | La analítica detecta patentes | El visor `http://10.150.2.165:4492/` responde, se detectan 5 patentes nuevas en `logs/<cámara>/<año>/<mes>/<día>/<hora>/log_file_*.log` y cada una tiene sus 3 fotos (`.jpg`, `_crop.jpg`, `_ref.jpg`) |
| AS-UNINSTALL-01 | Desinstalación (`installer2.4-rc1.sh ... -u`) | La salida muestra `Uninstalling Analytics Server` y `Service has been uninstalled.`, y el servicio deja de correr |

- Con `npm run test:as:headed` se abre el visor y la consola muestra cada patente a medida que
  se detecta y, al final, la ruta de sus fotos en el servidor.
- La cantidad de patentes a esperar se cambia en `PATENTES_ESPERADAS` (`tests/as/anpr.spec.ts`).
- El reloj del servidor está desfasado con el de las PCs: el test toma la hora del servidor
  para contar solo las patentes nuevas.
- Sin `AS_HOST` en el `.env` (por ejemplo en CI), estos tests se saltean.

## Casos automatizados – VMS (aplicaciones de escritorio)

VMS son aplicaciones de escritorio de Windows hechas en C# (**WinForms**, .NET Framework 4):
*Control Center* (`XDRControlCenter.exe`) y *Configurator* (`XDRConfigurator.exe`), instaladas en
`C:\Program Files (x86)\Danaide\UltraIP Client`. Los tests usan Playwright como *test runner* y
manejan las ventanas con **UI Automation de Windows** desde PowerShell, sin instalar nada:

- Los controles de VMS son personalizados (sin ids fijos ni acciones de accesibilidad): se buscan
  por el **texto visible** y se escribe y se hace clic con mensajes de Windows, como una persona.
- Los mensajes de error del login se dibujan sin exponer el texto: se leen con el **OCR de
  Windows** (idioma español) a partir de una captura de la ventana.

| ID | Caso | Control Center | Configurator |
|---|---|---|---|
| LOGIN-01 | Login en el sistema `system 145` muestra la pantalla principal | `VMS-CC-LOGIN-01` ✅ | `VMS-CFG-LOGIN-01` ✅ |
| LOGIN-02 | Usuario válido y contraseña incorrecta muestra "La contraseña es incorrecta" | `VMS-CC-LOGIN-02` ✅ | `VMS-CFG-LOGIN-02` ✅ |
| LOGIN-03 | Usuario y contraseña incorrectos muestra "Cuenta de usuario inválida" | `VMS-CC-LOGIN-03` ✅ | `VMS-CFG-LOGIN-03` ✅ |

- Mientras corren se abren las ventanas en el escritorio: no usar el mouse ni el teclado.
- Corren de a uno (`--workers=1`): dos Control Center abiertos a la vez se pisan.
- Los logins fallidos corren primero: con "Recordar" tildado la app guarda el último usuario
  escrito, y así queda recordando el usuario válido.
- Cada test adjunta al reporte una captura de la ventana.
- Solo corren en Windows y con `VMS_USER` en el `.env`; si no, se saltean.

## Comparación de herramientas

`npm run comparar` ejecuta los mismos casos en cada herramienta (mismo Chrome, sin ventana
visible, un test por vez) y genera un reporte HTML con tiempos totales, tiempo por caso e
historial de ejecuciones. Katalon se incorpora desde su último reporte del IDE (ver
observaciones).

Mediciones de referencia (5 casos de ANPR; los valores varían entre ejecuciones según la
carga de la máquina y del ambiente):

| Herramienta | Total | Observación |
|---|---|---|
| Playwright | **23 a 33 s** | La más rápida en todas las mediciones |
| Selenium | **31 a 34 s** | Un navegador nuevo por caso |
| Cypress | **42 a 44 s** | Mayor tiempo de arranque |
| Katalon | **55 s** | Desde el IDE; cada caso abre Chrome |

La ejecución de los casos en sí es similar entre herramientas; la diferencia principal está
en el tiempo de preparación (arranque de la herramienta y del navegador).

**Observaciones técnicas:**

- **Cypress** no puede seguir la redirección de `https` a `http` que hace ANPR al acceder sin
  sesión; esa validación se resuelve con una consulta directa al servidor.
- **Selenium** requiere un navegador nuevo por caso para aislar la sesión, y los enlaces del
  menú de usuario de ANPR no responden a su click nativo (se usa click por JavaScript).
- **Katalon** usa Selenium internamente y requirió el mismo click por JavaScript. Su
  ejecución por consola (`katalonc`), necesaria para CI, **requiere licencia paga de Katalon
  Runtime Engine**; sin ella solo puede ejecutarse desde el IDE.
- **Playwright** ejecutó todos los casos sin adaptaciones.

| Criterio | Playwright | Cypress | Selenium | Katalon |
|---|---|---|---|---|
| Licencia para ejecutar por consola / CI | Gratuita | Gratuita | Gratuita | Paga (KRE) |
| Adaptaciones necesarias en ANPR | Ninguna | Redirección https → http | Sesión y clicks | Clicks |
| Reporte HTML incluido | Sí | Con plugin | Con plugin | Sí |

## Tablero de seguimiento

Los casos de prueba se gestionan en el tablero
[QA Automation](https://github.com/users/maximilianofni/projects/6) de GitHub Projects.
Cada caso es un *issue* con su estado (**Todo**, **In Progress**, **Done**) y el campo
**Producto**, que permite sumar más sistemas en el mismo tablero:

| Producto | Estado |
|---|---|
| ANPR | En curso |
| Biblioteca Digital | En curso |
| Reconocimiento Facial Mendoza | Planificado |
| AS | En curso |
| VMS | En curso |

## Requisitos

- [Node.js](https://nodejs.org/) 22 o superior
- Google Chrome instalado
- Acceso a la red interna donde está el ambiente de testing

## Instalación

```bash
npm ci
```

Después copiá `.env.example` a `.env` y completá el usuario y la contraseña de testing:

```
BASE_URL=https://nginx-central-anpr.testing.docker.dev-dnd.com/www/
APP_USER=<usuario>
APP_PASSWORD=<contraseña>
BD_BASE_URL=http://vms-extractions-web.testing.deploy.danaide.com.ar/
BD_USER=<usuario de Biblioteca Digital>
BD_PASSWORD=<contraseña de Biblioteca Digital>
AS_HOST=10.150.2.165
AS_USER=<usuario de la VM de AS>
AS_PASSWORD=<contraseña de la VM de AS (también la de sudo)>
AS_DIR=/home/testing/server2.4
VMS_DIR=C:\Program Files (x86)\Danaide\UltraIP Client
VMS_SISTEMA=system 145
VMS_USER=<usuario de VMS>
VMS_PASSWORD=<contraseña de VMS>
KATALON_API_KEY=<API key de Katalon, solo para ejecutar Katalon por consola>
```

Katalon toma las credenciales del mismo `.env` (también al ejecutar desde el IDE), por lo que
el proyecto de Katalon no guarda usuario ni contraseña.

> El archivo `.env` **nunca se sube al repositorio** (está en `.gitignore`).

### Problemas comunes en Windows

- **`npm` no se reconoce como comando:** Node.js se instaló con la terminal (o VS Code) abierta.
  Cerrar VS Code por completo y volver a abrirlo.
- **"La ejecución de scripts está deshabilitada en este sistema":** PowerShell bloquea `npm`.
  Ejecutar una sola vez y abrir una terminal nueva:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```
  Otra opción, sin cambiar la configuración, es usar `npm.cmd` en lugar de `npm`.

## Cómo ejecutar los tests

| Herramienta | Comando | Qué hace |
|---|---|---|
| Playwright | `npm test` | Corre todos los tests sin mostrar el navegador |
| Playwright | `npm run test:headed` | Corre los tests de a uno, con Chrome visible y maximizado |
| Playwright | `npm run test:anpr` | Corre solo los tests de ANPR |
| Playwright | `npm run test:bd` | Corre solo los tests de Biblioteca Digital |
| Playwright | `npm run test:as` | Instala AS, espera las patentes y desinstala (por SSH) |
| Playwright | `npm run test:as:headed` | Lo mismo, mostrando el visor de patentes y cada patente en la consola |
| Playwright | `npm run test:vms` | Abre Control Center y Configurator y prueba el login (solo Windows) |
| Playwright | `npm run report` | Abre el reporte HTML de la última ejecución |
| Cypress | `npm run cy:run` | Corre todos los tests sin mostrar el navegador |
| Cypress | `npm run cy:headed` | Corre los tests con Chrome visible |
| Cypress | `npm run cy:open` | Abre la ventana de Cypress para elegir y ver los tests |
| Cypress | `npm run cy:report` | Abre el reporte HTML de la última ejecución |
| Selenium | `npm run se:run` | Corre todos los tests sin mostrar el navegador |
| Selenium | `npm run se:headed` | Corre los tests con Chrome visible y maximizado |
| Selenium | `npm run se:report` | Abre el reporte HTML de la última ejecución |
| Katalon | `npm run ka:run` | Corre la suite por consola (requiere licencia KRE) |
| Katalon | `npm run ka:headed` | Ídem, con Chrome visible (requiere licencia KRE) |
| Katalon | `npm run ka:report` | Abre el último reporte HTML, incluidos los generados desde el IDE |
| Todas | `npm run comparar` | Corre los mismos casos en cada herramienta y abre una página con la comparación de tiempos |
| Todas | `npm run comparar:ver` | Vuelve a abrir la última comparación |
| Jenkins | `npm run jenkins` | Levanta Jenkins en <http://localhost:8080> para la demo (ver [Jenkins](#jenkins-demo-local)) |

Cuando un test falla, el reporte guarda captura de pantalla, video y traza para analizar el error.

## Estructura del proyecto

```
tests/anpr/             Casos de ANPR con Playwright
tests/biblioteca-digital/  Casos de Biblioteca Digital con Playwright
tests/as/               Casos de AS (servidor de analíticas) por SSH
tests/vms/              Casos de VMS (aplicaciones de escritorio) con UI Automation y OCR
cypress/e2e/            Los mismos casos automatizados con Cypress
selenium/tests/         Los mismos casos automatizados con Selenium (Mocha)
katalon/                Proyecto Katalon Studio con los mismos casos (abrir ANPR.prj desde el IDE)
scripts/                Scripts de apoyo (lanzadores, comparación de herramientas)
reports/                Comparación de tiempos generada por `npm run comparar` (no se sube)
docs/                   Documentación del workshop
prompts/                Prompts para el agente de IA (uno por requerimiento)
.github/workflows/      Pipelines de CI y releases
Jenkinsfile             Pipeline de Jenkins (una etapa por producto)
playwright.config.ts    Configuración de Playwright (navegador, reportes, evidencias)
cypress.config.ts       Configuración de Cypress
.mocharc.json           Configuración de Mocha para Selenium
.env.example            Plantilla de variables del ambiente
CHANGELOG.md            Historial de versiones
```

## Integración continua (CI)

El proyecto tiene dos integraciones que se complementan:

| | GitHub Actions | Jenkins |
|---|---|---|
| **Dónde corre** | En los servidores de GitHub | En una PC con acceso a la red interna (hoy, la PC de la demo) |
| **Cuándo** | Automáticamente, en cada push y pull request | Al lanzar el build (*Build with Parameters*) |
| **Qué hace** | **Valida** que los tests de Playwright, Cypress y Selenium compilen, sin ejecutarlos | **Ejecuta** los tests contra los ambientes de testing: ANPR, Biblioteca Digital, AS y VMS |
| **Resultado** | Avisa al instante si un cambio rompe un test | Reporte por producto e historial de resultados entre builds |

Los servidores de GitHub no llegan a los ambientes de testing (están en la red interna) y no
tienen VMS instalado: por eso ahí solo se valida, y la ejecución completa corre en Jenkins.

### GitHub Actions

El pipeline [.github/workflows/ci.yml](.github/workflows/ci.yml) tiene dos etapas:

1. **Validación** (en cada push y pull request): instala dependencias y verifica que los tests
   de Playwright, Cypress y Selenium compilen. Corre en los servidores de GitHub.
2. **Tests end-to-end**: ejecuta los tests de Playwright contra el ambiente de testing. Como ese ambiente
   está en la red interna, esta etapa necesita un *self-hosted runner* (un equipo de la red
   interna registrado en GitHub). Queda desactivada hasta que se configure:
   - Registrar el runner en *Settings → Actions → Runners*.
   - Cargar las variables `BASE_URL`, `BD_BASE_URL` y `E2E_ENABLED=true` en *Settings → Secrets and variables → Actions → Variables*.
   - Cargar los secretos `APP_USER`, `APP_PASSWORD`, `BD_USER` y `BD_PASSWORD` en *Settings → Secrets and variables → Actions → Secrets*.

### Jenkins (demo local)

El [Jenkinsfile](Jenkinsfile) corre los tests de Playwright con una etapa por producto (ANPR,
Biblioteca Digital, AS y VMS), elegibles al lanzar el build, y publica un reporte por producto.
Si una etapa falla, las demás siguen corriendo.

Para la demo, Jenkins corre en la misma PC donde está instalado VMS. Se inicia desde una consola
de tu sesión (no como servicio de Windows), así los tests de VMS pueden abrir las aplicaciones.

1. **Instalar Java 21** (una sola vez) y abrir una consola nueva:
   ```
   winget install EclipseAdoptium.Temurin.21.JDK
   ```
2. **Levantar Jenkins** con `npm run jenkins` y dejar esa consola abierta. La primera vez descarga
   Jenkins (unos 100 MB).
3. **Configuración inicial** en <http://localhost:8080> (una sola vez):
   - Pegar la contraseña inicial, que aparece en la consola y en
     `%USERPROFILE%\.jenkins\secrets\initialAdminPassword`.
   - Elegir *Install suggested plugins* y crear el usuario administrador.
   - En *Administrar Jenkins → Plugins → Available plugins*, instalar **HTML Publisher**.
4. **Cargar las credenciales** en *Administrar Jenkins → Credentials → System → Global credentials
   → Add Credentials*, de tipo *Username with password* y con estos ID:

   | ID | Usuario y contraseña de |
   |---|---|
   | `anpr` | ANPR (`APP_USER` / `APP_PASSWORD`) |
   | `biblioteca-digital` | Biblioteca Digital (`BD_USER` / `BD_PASSWORD`) |
   | `as` | La VM de AS (`AS_USER` / `AS_PASSWORD`) |
   | `vms` | VMS (`VMS_USER` / `VMS_PASSWORD`) |

5. **Crear el job**: *Nueva tarea* → nombre `qa-ai-workshop` → tipo **Pipeline**. En *Pipeline*
   elegir *Pipeline script from SCM* → *Git*, con la URL
   `https://github.com/maximilianofni/qa-ai-workshop.git`, la rama `*/main` y el Script Path
   `Jenkinsfile`.
6. **Ejecutar**: la primera vez, *Construir ahora* (usa los valores por defecto). Después aparece
   *Build with Parameters* para elegir qué productos correr. Todos vienen tildados; AS tarda varios
   minutos porque instala y desinstala en la VM.

En cada build se ve el avance etapa por etapa. En el menú del build quedan *Test Result* (con el
historial de casos entre builds) y un **Reporte** por producto, con capturas, videos y trazas.

- Jenkins baja el código de GitHub: lo que no esté pusheado no se prueba.
- Durante la etapa de VMS las aplicaciones se abren en el escritorio y pasan al frente solas
  (aunque se esté mirando el avance en el navegador): no usar el mouse ni el teclado mientras tanto.
- `npm run jenkins` desactiva la política de seguridad de contenido (CSP) de Jenkins para que el
  reporte de Playwright se vea. Está pensado solo para la demo local.

### Llevarlo a la empresa

Con Jenkins o con el *self-hosted runner* de GitHub, la ejecución completa necesita lo mismo:
un equipo dentro de la red interna. ANPR, Biblioteca Digital y AS corren en cualquier equipo
(incluso en Linux con Docker, con la imagen oficial de Playwright). **VMS necesita una PC o VM
Windows con escritorio**, porque los tests abren las aplicaciones, hacen clic y leen la pantalla,
igual que una persona. Esa máquina se prepara así:

- **Inicio de sesión automático (auto-logon)**: con la herramienta *Autologon* de Microsoft
  (Sysinternals), para que después de un reinicio (por ejemplo por Windows Update) la sesión
  vuelva a quedar abierta sin que nadie escriba la contraseña.
- **El agente corre dentro de esa sesión, no como servicio de Windows**: un servicio corre en una
  sesión aparte, sin escritorio visible, y las aplicaciones de VMS no se verían. El agente (de
  Jenkins o el runner de GitHub) se inicia con un `.bat` en la carpeta *Inicio* del usuario
  (`shell:startup`).
- **La pantalla no se bloquea**: pantalla y suspensión en *Nunca* y sin protector de pantalla. Si
  se entra por Escritorio remoto, al desconectarse la sesión se bloquea: entrar por la consola de
  la VM (VMware o Hyper-V) o, antes de cerrar el Escritorio remoto, ejecutar
  `tscon %sessionname% /dest:console`.

## Versiones y releases

El proyecto usa [versionado semántico](https://semver.org/lang/es/) (`MAJOR.MINOR.PATCH`) y
cada versión queda registrada en el [CHANGELOG](CHANGELOG.md).

Para publicar una versión nueva:

1. Actualizar `CHANGELOG.md` y el campo `version` de `package.json`.
2. Hacer el commit: `chore(release): vX.Y.Z`.
3. Crear y subir el tag:
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```
4. El pipeline [.github/workflows/release.yml](.github/workflows/release.yml) crea la
   release en GitHub automáticamente.

## Convención de commits

Cada cambio va en un commit separado, con un prefijo que indica el tipo. Si el commit
resuelve un caso del tablero, se agrega `Closes #N` para que el issue se cierre solo.

| Prefijo | Uso | Ejemplo |
|---|---|---|
| `test:` | Casos de prueba nuevos o modificados | `test: agrega LOGIN-02 contraseña incorrecta (Closes #4)` |
| `docs:` | Documentación | `docs: agrega README` |
| `ci:` | Pipelines de CI/CD | `ci: agrega validación de tests` |
| `fix:` | Corrección de un test roto | `fix: corrige selector del botón login` |
| `chore:` | Mantenimiento, versiones | `chore(release): v1.1.0` |
