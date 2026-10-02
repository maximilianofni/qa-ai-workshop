# Guía: crear el CI con IA (para la demo)

## ¿Qué es el CI?

**CI (Integración Continua)** es un robot de GitHub que, **cada vez que alguien sube un
cambio**, revisa automáticamente que los tests estén bien. Si algo está roto, avisa con una
❌ roja; si está bien, muestra un ✅ verde.

Ese robot se configura con un archivo de texto en esta carpeta:

```
.github/workflows/ci.yml
```

## ¿Qué hace nuestro CI?

| Etapa | Qué hace | Dónde corre | Estado |
|---|---|---|---|
| Validar tests | Revisa que todos los tests estén bien escritos | Servidores de GitHub | ✅ Funciona |
| Tests end-to-end | Ejecuta los tests contra la app ANPR | Una PC de la red interna (*runner*) | ⏸️ Apagado hasta configurar el runner |

> La app ANPR está en la red interna de la empresa, por eso GitHub no puede entrar a probarla.

## Cómo ver el CI funcionando

1. Abrí https://github.com/maximilianofni/qa-ai-workshop
2. Click en la pestaña **Actions** (arriba).
3. Vas a ver cada ejecución con ✅ o ❌. Click en una para ver el detalle de cada paso.
4. Arriba de todo aparece el **resumen de pruebas**: qué casos se revisaron y el resultado.

## Demo: crear el CI con IA, paso a paso

Para la demo lo hacemos en una **rama aparte**, así no se toca lo que ya funciona.

### Paso 1 – Crear una rama para la demo
En la terminal de Visual Studio Code / Antigravity:
```
git checkout -b demo-ci
```

### Paso 2 – Borrar el CI actual (para crearlo de cero)
```
git rm .github/workflows/ci.yml
```

### Paso 3 – Pedírselo a la IA
Abrí el chat del agente (en Antigravity o en Claude Code) y pegá el **prompt** que está al
final de esta guía.

### Paso 4 – Revisar lo que hizo la IA
- Que haya creado el archivo `.github/workflows/ci.yml`.
- Que **no** tenga usuario ni contraseña escritos dentro del archivo (deben venir de *secrets*).
- Que tenga el paso que escribe el **resumen de pruebas**.

### Paso 5 – Subirlo y mostrarlo
```
git add .
git commit -m "ci: pipeline creado con IA (demo)"
git push -u origin demo-ci
```
Después andá a la pestaña **Actions** en GitHub y mostrá cómo corre solo. ✅

### Paso 6 – Volver a la rama principal
Al terminar la demo:
```
git checkout main
```

---

## Prompt para la IA

Copiá y pegá esto en el chat del agente:

```
Trabajo en el equipo de QA de este proyecto de tests automatizados (Playwright, Cypress y Selenium).
Necesito que crees el pipeline de CI de GitHub Actions en .github/workflows/ci.yml.

Requisitos:
1. Que se ejecute en cada push a main, en cada pull request y también a mano.
2. Primera etapa "Validar tests": en los servidores de GitHub (ubuntu-latest),
   instalar Node 22, instalar dependencias con npm ci y verificar que los tests
   compilan sin ejecutarlos: Playwright con "npx playwright test --list",
   Cypress con "npx tsc --noEmit -p cypress" y Selenium con "npx mocha --dry-run".
3. Segunda etapa "Tests end-to-end": que corra solo si la primera pasó.
   Nuestra app de testing está en la red interna de la empresa, así que esta
   etapa tiene que correr en un self-hosted runner y quedar desactivada salvo
   que exista la variable del repositorio E2E_ENABLED con valor 'true'.
   Debe tomar BASE_URL de las variables del repositorio y APP_USER y
   APP_PASSWORD de los secrets. Nunca escribas credenciales en el archivo.
   Al final, guardar la carpeta playwright-report como artefacto aunque fallen los tests.
4. En cada ejecución, mostrar un resumen breve en español en la página de la
   ejecución (GitHub job summary):
   - En "Validar tests": una tabla con el ID y nombre de cada caso de prueba,
     y el total de casos.
   - En "Tests end-to-end": cuántos casos pasaron, cuántos fallaron y el
     nombre de los que fallaron.
5. Agregá comentarios cortos en español explicando cada parte.

Cuando termines, explicame en palabras simples qué hace cada etapa.
```
