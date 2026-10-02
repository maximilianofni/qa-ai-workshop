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
| [Katalon](https://katalon.com/) | Funcional (herramienta visual) | — | 🕒 Planificada |
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

| ID | Caso | Playwright | Cypress | Selenium | Issue |
|---|---|---|---|---|---|
| SMOKE-01 | La página de login abre en Chrome | ✅ | ✅ | ✅ | #1 |
| LOGIN-01 | Login exitoso con usuario válido | ✅ | ✅ | ✅ | #2 |
| LOGIN-02 | Login con contraseña incorrecta muestra el mensaje de error exacto | ✅ | ✅ | ✅ | #4 |
| LOGIN-03 | Login con campos vacíos muestra el mensaje de error exacto | ✅ | ✅ | ✅ | #4 |
| LOGOUT-01 | Cerrar sesión vuelve al login y bloquea el acceso al panel | ✅ | ✅ | ✅ | #3 |

## Comparación de herramientas

`npm run comparar` ejecuta los mismos casos en cada herramienta (mismo Chrome, sin ventana
visible, un test por vez) y genera un reporte HTML con tiempos totales, tiempo por caso e
historial de ejecuciones.

Última medición (5 casos de ANPR):

| Herramienta | Preparación | Ejecución de tests | **Total** |
|---|---|---|---|
| Playwright | 5,7 s | 17,3 s | **23,0 s** |
| Selenium | 18,9 s | 12,2 s | **31,1 s** |
| Cypress | 30,6 s | 11,7 s | **42,2 s** |

La ejecución de los casos es similar en las tres herramientas; la diferencia está en el tiempo
de preparación (arranque de la herramienta y del navegador).

**Observaciones técnicas:**

- **Cypress** no puede seguir la redirección de `https` a `http` que hace ANPR al acceder sin
  sesión; esa validación se resuelve con una consulta directa al servidor.
- **Selenium** requiere un navegador nuevo por caso para aislar la sesión, y los enlaces del
  menú de usuario de ANPR no responden a su click nativo (se usa click por JavaScript).
- **Playwright** ejecutó todos los casos sin adaptaciones.

## Tablero de seguimiento

Los casos de prueba se gestionan en el tablero
[QA Automation](https://github.com/users/maximilianofni/projects/6) de GitHub Projects.
Cada caso es un *issue* con su estado (**Todo**, **In Progress**, **Done**) y el campo
**Producto**, que permite sumar más sistemas en el mismo tablero:

| Producto | Estado |
|---|---|
| ANPR | En curso |
| Biblioteca Digital | Planificado |
| Reconocimiento Facial Mendoza | Planificado |
| AS | Planificado |
| VMS | Planificado |

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
```

> El archivo `.env` **nunca se sube al repositorio** (está en `.gitignore`).

## Cómo ejecutar los tests

| Herramienta | Comando | Qué hace |
|---|---|---|
| Playwright | `npm test` | Corre todos los tests sin mostrar el navegador |
| Playwright | `npm run test:headed` | Corre los tests de a uno, con Chrome visible y maximizado |
| Playwright | `npm run report` | Abre el reporte HTML de la última ejecución |
| Cypress | `npm run cy:run` | Corre todos los tests sin mostrar el navegador |
| Cypress | `npm run cy:headed` | Corre los tests con Chrome visible |
| Cypress | `npm run cy:open` | Abre la ventana de Cypress para elegir y ver los tests |
| Cypress | `npm run cy:report` | Abre el reporte HTML de la última ejecución |
| Selenium | `npm run se:run` | Corre todos los tests sin mostrar el navegador |
| Selenium | `npm run se:headed` | Corre los tests con Chrome visible y maximizado |
| Selenium | `npm run se:report` | Abre el reporte HTML de la última ejecución |
| Todas | `npm run comparar` | Corre los mismos casos en cada herramienta y abre una página con la comparación de tiempos |
| Todas | `npm run comparar:ver` | Vuelve a abrir la última comparación |

Cuando un test falla, el reporte guarda captura de pantalla, video y traza para analizar el error.

## Estructura del proyecto

```
tests/                  Casos de prueba automatizados con Playwright
cypress/e2e/            Los mismos casos automatizados con Cypress
selenium/tests/         Los mismos casos automatizados con Selenium (Mocha)
scripts/                Scripts de apoyo (lanzadores, comparación de herramientas)
reports/                Comparación de tiempos generada por `npm run comparar` (no se sube)
docs/                   Documentación del workshop
prompts/                Prompts para el agente de IA (uno por requerimiento)
.github/workflows/      Pipelines de CI y releases
playwright.config.ts    Configuración de Playwright (navegador, reportes, evidencias)
cypress.config.ts       Configuración de Cypress
.mocharc.json           Configuración de Mocha para Selenium
.env.example            Plantilla de variables del ambiente
CHANGELOG.md            Historial de versiones
```

## Integración continua (CI)

El pipeline [.github/workflows/ci.yml](.github/workflows/ci.yml) tiene dos etapas:

1. **Validación** (en cada push y pull request): instala dependencias y verifica que los tests
   de Playwright, Cypress y Selenium compilen. Corre en los servidores de GitHub.
2. **Tests end-to-end**: ejecuta los tests de Playwright contra el ambiente de testing. Como ese ambiente
   está en la red interna, esta etapa necesita un *self-hosted runner* (un equipo de la red
   interna registrado en GitHub). Queda desactivada hasta que se configure:
   - Registrar el runner en *Settings → Actions → Runners*.
   - Cargar la variable `BASE_URL` y la variable `E2E_ENABLED=true` en *Settings → Secrets and variables → Actions → Variables*.
   - Cargar los secretos `APP_USER` y `APP_PASSWORD` en *Settings → Secrets and variables → Actions → Secrets*.

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
