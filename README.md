# QA AI Workshop – Tests automatizados de ANPR

Pruebas automatizadas end-to-end de la aplicación **ANPR (UltraIP)**, escritas con
[Playwright](https://playwright.dev/) y desarrolladas con asistencia de IA.

El objetivo del workshop es mostrar cómo un equipo de QA puede pasar de casos de prueba
manuales a casos automatizados, usando herramientas de IA como
[Antigravity](docs/antigravity-para-testing.md) para acelerar el trabajo.

## ¿Qué es Antigravity?

**Antigravity** es un editor de código de Google (parecido a Visual Studio Code) con un
**agente de inteligencia artificial** integrado. Al agente se le habla en español, como a un
compañero de equipo, y él:

- **Escribe** el código de los tests.
- **Abre el navegador** y recorre la aplicación para encontrar botones, campos y mensajes.
- **Ejecuta** los tests y muestra el resultado.
- **Deja evidencia**: capturas, grabaciones y un plan de lo que hizo, para que una persona lo revise.

> Explicación para autoridades y no técnicos: [Antigravity aplicado a QA y Testing](docs/antigravity-para-testing.md).

## Cómo lo uso como tester senior

La IA no decide qué probar: **eso lo define el tester**. La IA hace el trabajo de programar.
Mi flujo de trabajo para cada caso es este:

| Paso | Quién | Qué se hace |
|---|---|---|
| 1. Diseñar el caso | Tester | Defino ID, pasos y resultado esperado, como en cualquier caso de prueba manual |
| 2. Registrarlo | Tester | Lo cargo en el [tablero de GitHub](#tablero-de-seguimiento) en **Todo** |
| 3. Pedirlo | Tester → IA | Completo la [plantilla](prompts/plantilla-requerimiento.md) y la adjunto en el chat del agente |
| 4. Explorar y programar | IA | El agente navega la app, encuentra los elementos y escribe el test |
| 5. Revisar | Tester | Corro `npm run test:headed`, miro la ejecución y verifico que el test pruebe lo que pedí |
| 6. Guardar | Tester | Commit con `Closes #N`: el caso pasa solo a **Done** en el tablero |

**Qué reviso siempre antes de aprobar un test hecho por IA:**

- Que verifique el **resultado esperado** real y no solo que "la página cargó".
- Que **falle** cuando tiene que fallar (por ejemplo, cambiando la contraseña a una incorrecta).
- Que **no** tenga usuarios ni contraseñas escritos en el código: van siempre en `.env`.
- Que el ID y el nombre del test coincidan con el caso del tablero.

### Prompt plantilla para crear un caso

Los prompts se guardan como archivos en la carpeta [prompts/](prompts/), para adjuntarlos en
el chat del agente:

| Archivo | Para qué |
|---|---|
| [prompts/plantilla-requerimiento.md](prompts/plantilla-requerimiento.md) | Plantilla vacía: se copia y se completa con cada requerimiento nuevo |
| [prompts/LOGIN-02.md](prompts/LOGIN-02.md) | Ejemplo completo: login con contraseña incorrecta |

Con cada requerimiento, el agente devuelve: archivos modificados, comandos para ejecutar los
tests por consola, reporte de casos, explicación simple y un **resumen para la líder**.

> Para crear el pipeline de CI con IA, ver [Guía: crear el CI con IA](docs/guia-ci-con-ia.md).

## Casos automatizados

| ID | Caso | Archivo | Issue |
|---|---|---|---|
| SMOKE-01 | La página de login abre en Chrome | [tests/smoke.spec.ts](tests/smoke.spec.ts) | #1 |
| LOGIN-01 | Login exitoso con usuario válido | [tests/login.spec.ts](tests/login.spec.ts) | #2 |
| LOGOUT-01 | Cerrar sesión vuelve al login y bloquea el acceso al panel | [tests/login.spec.ts](tests/login.spec.ts) | #3 |
| LOGIN-02 | Login con contraseña incorrecta muestra el mensaje de error exacto | [tests/login.spec.ts](tests/login.spec.ts) | #4 |
| LOGIN-03 | Login con campos vacíos muestra el mensaje de error exacto | [tests/login.spec.ts](tests/login.spec.ts) | #4 |

## Tablero de seguimiento

Los casos de prueba se gestionan en el tablero
[QA Automation](https://github.com/users/maximilianofni/projects/6) de GitHub Projects.
Cada caso es un *issue* con su estado (**Todo**, **In Progress**, **Done**) y el campo
**Producto**, que permite sumar más sistemas en el mismo tablero:

| Producto | Estado |
|---|---|
| ANPR | En curso |
| Biblioteca Digital | Próximamente |
| Reconocimiento Facial Mendoza | Próximamente |
| AS | Próximamente |
| VMS | Próximamente |

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
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

| Comando | Qué hace |
|---|---|
| `npm test` | Corre todos los tests sin mostrar el navegador |
| `npm run test:headed` | Corre los tests de a uno, con Chrome visible y maximizado |
| `npm run report` | Abre el reporte HTML de la última ejecución |

Cuando un test falla, el reporte guarda captura de pantalla, video y traza para analizar el error.

## Estructura del proyecto

```
tests/                  Casos de prueba automatizados
docs/                   Documentación del workshop
prompts/                Prompts para el agente de IA (uno por requerimiento)
.github/workflows/      Pipelines de CI y releases
playwright.config.ts    Configuración de Playwright (navegador, reportes, evidencias)
.env.example            Plantilla de variables del ambiente
CHANGELOG.md            Historial de versiones
```

## Integración continua (CI)

El pipeline [.github/workflows/ci.yml](.github/workflows/ci.yml) tiene dos etapas:

1. **Validación** (en cada push y pull request): instala dependencias y verifica que todos los
   tests compilen y se puedan listar. Corre en los servidores de GitHub.
2. **Tests end-to-end**: ejecuta los tests contra el ambiente de testing. Como ese ambiente
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
