# CI/CD para testers: GitHub Actions, Jenkins, Docker y Kubernetes

Guía para explicar en el workshop qué es cada herramienta, para qué la usa un tester y cómo la
usamos en este proyecto. Al final, preguntas frecuentes con su respuesta.

## La idea en una frase

**CI/CD es que los tests corran solos cada vez que algo cambia, siempre de la misma forma, y que
el resultado quede a la vista de todos.**

- **CI (integración continua):** cada cambio que se sube al repositorio se valida automáticamente
  (compila, pasan los tests). Si algo se rompe, se sabe en minutos y no días después.
- **CD (entrega o despliegue continuo):** lo que pasa las validaciones queda listo para publicarse
  (o se publica solo). En este proyecto hacemos la parte de CI y una release automática.

**Para un tester:** dejamos de "acordarnos de correr los tests". Corren solos, en un entorno
controlado, con reporte y evidencia, y cualquiera del equipo ve si algo se rompió.

## Las cuatro herramientas, con una analogía

Pensemos en una **cocina de restaurante**:

| Herramienta | Analogía | Qué es | Pregunta que responde |
|---|---|---|---|
| **GitHub Actions** | El control de calidad en la puerta: revisa cada pedido que entra | Automatización de GitHub que corre tareas en servidores de GitHub cada vez que se sube código | ¿El código está sano? |
| **Jenkins** | El jefe de cocina: organiza qué se hace, en qué orden y deja registro | Servidor de automatización que instalamos nosotros, dentro de nuestra red | ¿El sistema funciona de punta a punta? |
| **Docker** | El táper: la comida va igual en cualquier heladera | Empaqueta una aplicación con todo lo que necesita (en nuestro caso Node, Chrome y los tests) en una "imagen" que corre igual en cualquier máquina | ¿Corre igual en todos lados? |
| **Kubernetes** | La cadena de cocinas: reparte los pedidos entre varios cocineros | Orquestador: decide dónde y cuántos contenedores correr, en paralelo, y los reinicia o los limpia | ¿Y si son muchos tests? |

No compiten entre sí: **se complementan**. Un flujo típico:

```
Push a GitHub → GitHub Actions valida → Jenkins corre los end-to-end → los tests corren en Docker → Kubernetes los reparte en paralelo
```

## GitHub Actions

- **Qué es:** el sistema de automatización que viene con GitHub. Se configura con archivos
  `.yml` en `.github/workflows/`.
- **Para qué lo usamos:** en cada push a `main` valida que compilen los tests de Playwright,
  Cypress y Selenium (`ci.yml`). Al crear un tag `v*` publica la release (`release.yml`).
- **Ventajas:** gratis para repositorios como el nuestro, sin servidores que mantener, y se ve en
  la pestaña *Actions* del repo.
- **Límite:** corre en la nube de GitHub, **sin acceso a nuestra red interna**: no llega a ANPR,
  AS ni VMS. Por eso ahí solo validamos, no corremos los end-to-end.

## Jenkins

- **Qué es:** un servidor de automatización open source. Lo instalamos nosotros (en la demo, en
  esta PC con `npm run jenkins`).
- **Para qué lo usamos:** correr los tests end-to-end **dentro de la red**, donde sí llega a los
  ambientes de testing. Un job por producto (`qa-ai-workshop`) y uno por integración
  (`integracion-as-anpr`, `integracion-vms-bd`, `integracion-as-vms`). Cada uno está definido en un
  `Jenkinsfile` versionado en el repo.
- **Qué aporta al tester:** credenciales guardadas en Jenkins (no en el código), el avance etapa
  por etapa, el reporte HTML con capturas y videos, y el **historial de resultados** entre builds.
- **Por qué no todo en GitHub Actions:** porque necesitamos la red interna y, para VMS, el
  escritorio de Windows. GitHub Actions podría hacerlo con un *runner* propio instalado adentro;
  Jenkins es la opción más común en empresas para eso.

## Docker

- **Qué es:** una forma de empaquetar una aplicación con todo lo que necesita. El **Dockerfile**
  es la receta; la **imagen** es el paquete armado; el **contenedor** es la imagen corriendo.
- **Para qué lo usamos:** la imagen `qa-ai-workshop-tests` tiene Node, Google Chrome y los tests.
  `npm run docker:build` la arma y `npm run docker:test` corre ANPR y Biblioteca Digital adentro.
- **Qué aporta al tester:** se termina el "en mi máquina anda". Mismas versiones de todo, en mi PC,
  en la de un compañero o en Jenkins. Y no hay que instalar nada más que Docker.
- **Seguridad:** las credenciales **no** entran en la imagen; se pasan al correrla (`--env-file .env`).
- **Límite:** VMS no corre en Docker, porque necesita el escritorio de Windows.

## Kubernetes

- **Qué es:** un orquestador de contenedores. Le decimos *qué* queremos correr y él decide *dónde*,
  cuántas copias, y qué hacer si algo falla. Las piezas que usamos:
  - **Pod:** donde corre un contenedor.
  - **Job:** una tarea que corre hasta terminar (justo lo que es una corrida de tests).
  - **Secret:** donde se guardan las credenciales.
- **Para qué lo usamos:** `npm run k8s:test` carga las credenciales como Secret y lanza **dos Jobs
  en paralelo**, uno para ANPR y otro para Biblioteca Digital, cada uno en su pod, con la misma
  imagen de Docker (`k8s/tests.yaml`).
- **Qué aporta al tester:** correr muchos tests a la vez sin que se pisen, y la base para correr
  tests dentro del mismo cluster donde se despliegan las aplicaciones (por ejemplo, un smoke
  después de cada despliegue).
- **En la demo:** un Kubernetes de un solo nodo que trae Rancher Desktop. En una empresa sería un
  cluster real.

### Job, Pod, contenedor e imagen: cómo leer lo que muestra Rancher

**El Job es la orden, el Pod es donde corre, y el contenedor es nuestra caja con los tests,**
hecha a partir de la imagen.

| Concepto | Qué es | En la demo |
|---|---|---|
| **Imagen** | El molde: Node, Chrome y los tests | `qa-ai-workshop-tests` (en Rancher aparece como `sha256:e3c…`) |
| **Job** | La orden "corré esto hasta que termine"; dice si pasó (*Complete*) o falló (*Failed*) | `qa-tests-anpr` y `qa-tests-biblioteca` |
| **Pod** | Donde corre: uno o más contenedores que comparten la red | `default/qa-tests-anpr-p7brh` |
| **Contenedor** | La imagen en ejecución | `k8s_playwright_qa-tests-anpr-p7brh_default` |

- **Nombre del pod** `default/qa-tests-anpr-p7brh`: `default` es el *namespace* (una carpeta de
  Kubernetes), `qa-tests-anpr` el Job que lo creó y `p7brh` letras al azar, distintas en cada corrida.
- **Nombre del contenedor** `k8s_<contenedor>_<pod>_<namespace>`: `playwright` es el nombre que le
  dimos en `k8s/tests.yaml`; es el que corre los tests.
- **`k8s_POD_…` con la imagen `rancher/mirrored-pause`:** el contenedor de pausa que Kubernetes pone
  en cada pod para guardar su red. No hace nada visible; se puede ignorar.
- **"exited":** el contenedor terminó. En un Job es lo esperado; si los tests fallan, el Job dice
  *Failed*. `npm run k8s:limpiar` los borra.

Para mostrarlo en la consola: `kubectl get jobs`, `kubectl get pods` y
`kubectl logs job/qa-tests-anpr`.

## Docker Desktop o Rancher Desktop

Docker Desktop es **pago** para uso en empresas de más de 250 empleados o 10 millones de dólares
de facturación, aunque se use con una cuenta personal: cuenta el uso, no el correo. Usamos
**Rancher Desktop**: gratis y open source, trae el motor de Docker y Kubernetes, y el mismo
Dockerfile y los mismos comandos funcionan igual. Es la misma lógica que con Katalon (licencia paga
para correr por consola) frente a Playwright (gratis).

## Preguntas frecuentes

**¿Para qué necesito CI/CD si ya corro los tests a mano?**
Porque a mano dependen de que alguien se acuerde, en su PC y con su configuración. Con CI/CD
corren solos en cada cambio, siempre igual, y el resultado queda registrado para todo el equipo.

**¿Por qué GitHub Actions y Jenkins? ¿No hacen lo mismo?**
Hacen cosas parecidas en lugares distintos. GitHub Actions corre en la nube y no llega a nuestra
red: lo usamos para validar rápido en cada push. Jenkins corre adentro y llega a los ambientes de
testing y al escritorio de VMS: lo usamos para los end-to-end.

**¿Docker reemplaza a Jenkins?**
No. Jenkins decide *cuándo* y *qué* correr; Docker define *en qué entorno* corre. Jenkins puede
correr los tests dentro de un contenedor Docker.

**¿Kubernetes reemplaza a Docker?**
No. Docker arma y corre contenedores; Kubernetes organiza muchos contenedores (dónde, cuántos, en
paralelo). Kubernetes usa las mismas imágenes de Docker.

**¿Por qué VMS no está en Docker ni en Kubernetes?**
Porque Control Center es una aplicación de escritorio de Windows: el test hace clics con el mouse y
lee la pantalla. Los contenedores no tienen ese escritorio. Por eso VMS corre en Jenkins, en una PC
con la sesión abierta.

**¿Dónde quedan las contraseñas?**
Nunca en el código ni en la imagen. En la PC, en el `.env` (que no se sube a GitHub); en Jenkins, en
sus credenciales; en Kubernetes, en un Secret.

**¿Es caro?**
GitHub Actions, Jenkins, Rancher Desktop y Kubernetes son gratis (Jenkins y Kubernetes necesitan
una máquina donde correr). Lo pago es Docker Desktop en empresas grandes, y Katalon para correr por
consola.

**¿Esto lo puede usar el equipo hoy?**
Sí: los comandos están en [comandos-workshop.md](comandos-workshop.md). Para llevarlo a producción
habría que definir con IT dónde corre Jenkins (un servidor o una PC dedicada) y, si se usa
Kubernetes, en qué cluster.
