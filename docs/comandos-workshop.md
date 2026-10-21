# Comandos del workshop

Guía para la demo, en el orden del workshop. Todos los comandos se ejecutan desde la terminal de
VS Code, en la carpeta del proyecto (`qa-ai-workshop`), con el `.env` completo.

Después de cualquier test de Playwright, el reporte con capturas, videos y adjuntos se abre con:

```
npm run report
```

---

## 1. Tests de ANPR

Login, logout, smoke y alta y baja de patentes en la web de ANPR.

```
npm run test:anpr
```

Para ver el navegador mientras corren:

```
npx playwright test --project=anpr --headed --workers=1
```

**Requiere:** `BASE_URL`, `APP_USER` y `APP_PASSWORD` en el `.env`.

---

## 2. Comparación de frameworks de automatización

Corre los mismos casos de ANPR en Playwright, Cypress, Selenium y Katalon (mismo Chrome, sin ventana,
de a un test por vez) y abre una página con los tiempos de cada herramienta.

```
npm run comparar
```

Para volver a abrir la última comparación sin correr nada:

```
npm run comparar:ver
```

Cada herramienta por separado, con la ventana visible:

| Herramienta | Comando |
|---|---|
| Playwright | `npx playwright test --project=anpr --headed --workers=1` |
| Cypress | `npm run cy:headed` |
| Selenium | `npm run se:headed` |
| Katalon | `npm run ka:headed` (requiere licencia KRE) |

---

## 3. Integración AS → ANPR

La analítica de AS detecta patentes en un video y las manda a ANPR: llegan al widget Lista, generan
alarmas que se atienden y quedan en Auditoría. Al final se verifica en la base de datos de ANPR, y la
consulta se ve en pgAdmin.

Con todo a la vista (ANPR a la izquierda, el video de AS a la derecha y después pgAdmin):

```
npm run test:integracion:headed -- as-anpr/alarmas
```

Solo las patentes que llegan al widget Lista y su detalle:

```
npm run test:integracion:headed -- as-anpr/lista
```

Las dos juntas:

```
npm run test:integracion:headed -- as-anpr
```

**Requiere:** `AS_HOST`, `AS_USER`, `AS_PASSWORD`, `AS_DIR`, `APP_USER`, `ANPR_DB_*` y `PGADMIN_*` en
el `.env`. AS no tiene que estar instalado por otra ejecución (por ejemplo Jenkins): si lo está, el
test se frena con un aviso.

---

## 4. Integración VMS → Biblioteca Digital

Desde Control Center se pide una extracción remota de 10 minutos de "camara Balcon, Channel 1" y se
verifica que llegue a Biblioteca Digital como proyecto Finalizado. La web de Biblioteca se abre sola
al principio y vuelve a quedar a la vista cuando Control Center termina.

```
npm run test:integracion -- vms-bd
```

**Requiere:** Windows, `VMS_USER`, `VMS_PASSWORD`, `BD_BASE_URL`, `BD_USER` y `BD_PASSWORD` en el
`.env`.

**Importante:** la PC tiene que estar **desbloqueada** y no hay que tocar el mouse ni el teclado
mientras trabaja Control Center (unos 2 minutos): el test mueve el mouse y lee la pantalla.

---

## 5. Integración AS → VMS (Residuos)

Control Center abre en vivo la cámara "vlc_16_residuos, Channel 1" (grupo Residuos). En el servidor
de AS (10.150.2.165), el test cambia los últimos `execution_time` de
`server_config_Residuos_VMS_145.json` para que la analítica de residuos se ejecute cada 30 segundos
durante 3 minutos (7 ejecuciones, desde la hora del servidor) e instala AS:

```
sudo ./installer2.4-rc1.sh -a cuda -v 2.4-rc1 -j ./server_config_Residuos_VMS_145.json -i
```

Los eventos "Desborde de residuos detectado" van apareciendo en el panel de Eventos de Control
Center. **Cada vez que llega uno, el test abre su modal "Información del evento"** (foto con el
residuo marcado, Id, fecha y hora, fuente, tipo y descripción), lo verifica, guarda una captura y lo
cierra. **Al llegar el tercer evento, corta.** Si AS saltea alguna ejecución (no recibió imagen de la
cámara a tiempo), queda como aviso en el reporte.

```
npm run test:integracion -- as-vms
```

Tarda unos 4 minutos. Al terminar, aunque falle, AS queda desinstalado y el JSON vuelve a tener sus
horarios originales.

**Requiere:** Windows, `VMS_USER`, `VMS_PASSWORD`, `AS_HOST`, `AS_USER`, `AS_PASSWORD` y `AS_DIR` en
el `.env`. AS no tiene que estar instalado por otra ejecución.

**Importante:** PC desbloqueada y sin otros Control Center abiertos. No tocar el mouse ni el teclado
durante toda la prueba: el test abre la cámara y los modales de los eventos con clics.

---

## 6. CI/CD: GitHub Actions y Jenkins

La idea a mostrar: **GitHub Actions** valida en la nube de GitHub en cada push; **Jenkins** corre
los end-to-end acá adentro, donde llega a la red interna y al escritorio que necesita VMS.

### Antes de la demo

1. Levantar Jenkins en una consola y **dejarla abierta** (si se cierra, Jenkins se detiene):

   ```
   npm run jenkins
   ```

2. Entrar a <http://localhost:8080> con el usuario de Jenkins.
3. Tener abierta la pestaña **Actions** del repo:
   <https://github.com/maximilianofni/qa-ai-workshop/actions>.

### Guion

1. **GitHub Actions – CI.** Hacer un cambio chico (por ejemplo, en esta guía), commit y push a
   `main`. En *Actions* aparece el workflow **CI**, que valida que compilen los tests de Playwright,
   Cypress y Selenium. Mostrar que termina en verde y que corre en un servidor de GitHub, sin acceso a
   la red interna.
2. **GitHub Actions – Release.** Contar que al crear un tag `v*` (por ejemplo `v1.5.0`) el workflow
   **Release** publica la versión con sus notas. No hace falta crearlo en vivo.
3. **Jenkins – productos.** Job `qa-ai-workshop` → *Build with Parameters* → destildar AS y VMS para
   que sea rápido (ANPR y Biblioteca Digital, menos de un minuto) → *Construir*. Mostrar el avance
   etapa por etapa.
4. **Jenkins – una integración.** Job `integracion-as-anpr` → *Build with Parameters* → destildar
   *Alarmas* (más corta) y tildar **VER_NAVEGADOR** → *Construir*. Se ven ANPR y el video de AS lado a
   lado mientras corre (unos 2 minutos).
5. **Resultados.** En el build: *Test Result* (casos y su historial entre builds) y el **Reporte**
   HTML con capturas, videos y trazas.
6. **Cierre:** cada integración tiene su Jenkinsfile y su job (`integracion-as-anpr`,
   `integracion-vms-bd`, `integracion-as-vms`); las credenciales viven en Jenkins, no en el código.

**Tiempos aproximados de cada job completo:** `integracion-as-anpr` 4,5 min, `integracion-vms-bd`
3 min e `integracion-as-vms` 4,5 min. Los dos de VMS necesitan la PC desbloqueada y sin tocar el
mouse: para una demo en vivo conviene mostrar un build ya hecho.

---

## Extra: tests de login de VMS

Login correcto, contraseña incorrecta y usuario inválido en Control Center y Configurator.

```
npm run test:vms
```

Igual que la integración con Biblioteca: PC desbloqueada y sin tocar el mouse.
