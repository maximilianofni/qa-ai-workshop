# Plantilla de requerimiento

> **Cómo usarla:** copiá este archivo con el nombre del requerimiento
> (por ejemplo `LOGIN-02.md`), completá lo que está entre `< >` y adjuntalo en el chat del agente.

Soy tester y trabajo en este proyecto de tests automatizados con Playwright.
Llegó un requerimiento nuevo y necesito que automatices sus casos de prueba.

## Requerimiento

- **Producto:** <ANPR | Biblioteca Digital | Reconocimiento Facial | AS | VMS>
- **Descripción:** <qué pide el requerimiento, en pocas palabras>
- **Issue del tablero:** <#número, si existe>

## Caso 1

- **ID:** <por ejemplo LOGIN-02>
- **Nombre:** <por ejemplo Login con contraseña incorrecta>
- **Precondición:** <por ejemplo estar en la pantalla de login>

**Pasos:**
1. <paso 1>
2. <paso 2>

**Resultado esperado:**
- <qué tiene que pasar>

<!-- Si hay más casos, copiar el bloque "Caso 1" como "Caso 2", "Caso 3"... -->

## Reglas

- Antes de escribir los tests, abrí la aplicación y verificá cómo se comporta realmente.
- Seguí el mismo estilo de los tests que ya existen en la carpeta `tests/`.
- Usuario y contraseña siempre desde el archivo `.env`, nunca escritos en el código.
- Ejecutá los tests vos mismo.
- No hagas commit ni push hasta que yo lo apruebe.

## Qué tenés que devolverme

1. Archivos creados o modificados.
2. Comando para que yo lo ejecute en la consola si quiero verlo
   (uno sin navegador y uno con el navegador visible).
3. Reporte de casos, en una tabla: `ID | Caso | Resultado (Pasó / Falló) | Observaciones`.
4. Explicación en palabras simples de qué verifica cada test.
5. Resumen para mi líder (corto, sin lenguaje técnico):
   - Qué se automatizó y para qué requerimiento.
   - Resultado general.
   - Defectos o comportamientos raros encontrados en la aplicación.
   - Riesgos o casos que quedaron sin cubrir.
   - Recomendación de próximos casos a automatizar.
