# Demo en vivo con Antigravity: LOGIN-04

> **Cómo usarlo:** en Antigravity, con el proyecto `qa-ai-workshop` abierto y el modo **Request
> Review**, abrir una **New Conversation** y pegar el **Mensaje 1**. Cuando el agente muestre su plan
> y la captura, pegar el **Mensaje 2**. Aprobar los permisos con **1 "Yes, allow this time"**.
> El caso no necesita iniciar sesión ni contraseñas: es seguro para hacerlo en vivo.

---

## Mensaje 1: explorar y planificar

```
Respondé siempre en español.

Trabajo en el equipo de QA de este proyecto de tests automatizados.
Llegó un requerimiento nuevo y necesito que automatices su caso de prueba.

## Requerimiento

- Herramienta: Playwright
- Producto: ANPR
- Descripción: la contraseña no tiene que quedar visible mientras el usuario la escribe en el login.

## Caso 1

- ID: LOGIN-04
- Nombre: El campo Contraseña oculta lo que se escribe
- Precondición: estar en la pantalla de login de ANPR, sin sesión iniciada.

Pasos:
1. Abrir https://nginx-central-anpr.testing.docker.dev-dnd.com/www/login.php
2. Escribir un texto de prueba (por ejemplo "prueba123") en el campo Contraseña.

Resultado esperado:
- El campo Contraseña oculta lo que se escribe (se ven puntos, no el texto).
- El campo Usuario sí muestra lo que se escribe.

## Reglas

- Con tu navegador integrado abrí la página y verificá cómo se comporta realmente. Sacá una captura.
- No inicies sesión y no leas el archivo .env: este caso no necesita credenciales.
- Todavía no escribas código: mostrame primero tu plan (qué vas a verificar y en qué archivo) y esperá mi aprobación.
```

---

## Mensaje 2: escribir y ejecutar (después de revisar el plan)

```
Respondé en español. El plan está aprobado.

- Agregá el test LOGIN-04 en tests/anpr/login.spec.ts, con el mismo estilo de los tests que ya están.
- Ejecutalo vos con: npx playwright test --project=anpr -g "LOGIN-04"
- No hagas commit ni push hasta que yo lo apruebe.

Devolveme:
1. El archivo modificado.
2. El comando para verlo con el navegador visible.
3. Una tabla: ID | Caso | Resultado (Pasó / Falló) | Observaciones.
4. En palabras simples, qué verifica el test.
5. Un resumen de 3 líneas para la líder del equipo.
```

---

## Qué mostrar mientras trabaja

| Momento | Qué decir |
|---|---|
| Pide permisos | "Trabaja en modo Request Review: cada acción la aprueba el tester." |
| Abre su navegador | "Esto es lo que lo diferencia: usa la aplicación como un usuario." |
| Muestra la captura y el plan | "Antes de escribir código, me muestra qué va a hacer. Si no me convence, lo corrijo en español." |
| Escribe y ejecuta el test | "El test queda en el proyecto, igual que los que ya teníamos." |
| Devuelve la tabla y el resumen | "Y me deja el reporte y un resumen para la líder: lo reviso yo antes de subirlo." |

## Plan B

Si en vivo tarda o falla: mostrar las capturas y el resultado del ensayo previo, y correr
`npx playwright test --project=anpr -g "LOGIN-04" --headed` desde la terminal.

## Después de la demo

Revisar el test que escribió. Si está bien, hacer commit con su issue; si no, descartar el cambio
con `git checkout tests/anpr/login.spec.ts`.
