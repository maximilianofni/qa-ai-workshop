# QA AI Workshop – Tests automatizados de ANPR

Pruebas automatizadas end-to-end de la aplicación **ANPR (UltraIP)**, escritas con
[Playwright](https://playwright.dev/) y desarrolladas con asistencia de IA.

El objetivo del workshop es mostrar cómo un equipo de QA puede pasar de casos de prueba
manuales a casos automatizados, usando herramientas de IA como
[Antigravity](docs/antigravity-para-testing.md) para acelerar el trabajo.

## Casos automatizados

| ID | Caso | Archivo |
|---|---|---|
| SMOKE-01 | La página de login abre en Chrome | [tests/smoke.spec.ts](tests/smoke.spec.ts) |
| LOGIN-01 | Login exitoso con usuario válido | [tests/login.spec.ts](tests/login.spec.ts) |
| LOGOUT-01 | Cerrar sesión vuelve al login y bloquea el acceso al panel | [tests/login.spec.ts](tests/login.spec.ts) |

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

Cada cambio va en un commit separado, con un prefijo que indica el tipo:

| Prefijo | Uso | Ejemplo |
|---|---|---|
| `test:` | Casos de prueba nuevos o modificados | `test: agrega LOGIN-02 contraseña incorrecta` |
| `docs:` | Documentación | `docs: agrega README` |
| `ci:` | Pipelines de CI/CD | `ci: agrega validación de tests` |
| `fix:` | Corrección de un test roto | `fix: corrige selector del botón login` |
| `chore:` | Mantenimiento, versiones | `chore(release): v1.1.0` |
