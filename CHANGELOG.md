# Changelog

Todos los cambios relevantes del proyecto se registran en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

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

[1.1.0]: https://github.com/maximilianofni/qa-ai-workshop/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/maximilianofni/qa-ai-workshop/releases/tag/v1.0.0
