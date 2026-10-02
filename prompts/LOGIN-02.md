# Requerimiento: LOGIN-02

Trabajo en el equipo de QA de este proyecto de tests automatizados.
Llegó un requerimiento nuevo y necesito que automatices sus casos de prueba.

## Requerimiento

- **Herramienta:** Playwright
- **Producto:** ANPR
- **Descripción:** Validar que el login rechace credenciales incorrectas
- **Issue del tablero:** #4

## Caso 1

- **ID:** LOGIN-02
- **Nombre:** Login con contraseña incorrecta
- **Precondición:** estar en la pantalla de login

**Pasos:**
1. Ingresar el usuario válido del archivo `.env`
2. Ingresar una contraseña incorrecta
3. Hacer clic en el botón Login

**Resultado esperado:**
- Aparece un mensaje de error indicando que los datos son incorrectos
- El usuario sigue en la pantalla de login
- No se puede entrar al Panel de control

## Reglas

- Antes de escribir los tests, abrí la aplicación y verificá cómo se comporta realmente.
- Seguí el mismo estilo de los tests existentes de la herramienta indicada.
- Usuario y contraseña siempre desde el archivo `.env`, nunca escritos en el código.
- Ejecutá los tests vos mismo.
- No hagas commit ni push hasta que yo lo apruebe.

## Qué tenés que devolverme

1. Archivos creados o modificados.
2. Comando para que yo lo ejecute en la consola si quiero verlo
   (uno sin navegador y uno con el navegador visible).
3. Reporte de casos, en una tabla: `ID | Caso | Resultado (Pasó / Falló) | Observaciones`.
4. Explicación en palabras simples de qué verifica cada test.
5. Resumen ejecutivo para la líder del equipo (breve, sin lenguaje técnico):
   - Qué se automatizó y para qué requerimiento.
   - Resultado general.
   - Defectos o comportamientos raros encontrados en la aplicación.
   - Riesgos o casos que quedaron sin cubrir.
   - Recomendación de próximos casos a automatizar.
