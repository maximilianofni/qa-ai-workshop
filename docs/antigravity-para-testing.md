# Antigravity aplicado a QA y Testing

## Resumen

**Antigravity** es un entorno de desarrollo de Google con agentes de inteligencia artificial
integrados. A diferencia de un asistente que solo sugiere código, sus agentes **ejecutan
tareas completas**: escriben código, lo ejecutan, abren un navegador, navegan la aplicación y
devuelven evidencia (capturas, grabaciones, planes de trabajo) para que una persona la revise.

En QA lo usamos para **automatizar casos de prueba más rápido**. El analista de QA define
**qué** se prueba y **qué resultado se espera**, y el agente se encarga de escribir el código y
ejecutarlo.

## ¿Para qué sirve en testing?

| Tarea de QA | Sin IA | Con Antigravity |
|---|---|---|
| Automatizar un caso de prueba | El tester escribe el código a mano; requiere saber programar | El tester describe el caso en español y el agente genera el test |
| Exploración de la aplicación | Recorrido manual de pantallas | El agente navega la aplicación y propone casos de prueba |
| Análisis de un test fallido | Revisar logs y código manualmente | El agente analiza el error, la captura y propone la corrección |
| Mantenimiento de tests | Actualizar selectores uno por uno cuando cambia la interfaz | El agente detecta qué cambió y ajusta los tests |
| Evidencia | Capturas manuales | Capturas, videos y reportes generados en cada ejecución |

## Ejemplo real en este proyecto

Los casos **LOGIN-01** (login exitoso) y **LOGOUT-01** (cierre de sesión) se pidieron en
lenguaje natural, por ejemplo:

> *"Hacé que el test inicie sesión con el usuario de testing, espere 2 segundos en el panel
> de control y después cierre sesión."*

La IA exploró la aplicación para encontrar el botón de cierre de sesión, escribió los tests,
los ejecutó y confirmó que pasan. El tester revisó el resultado viendo la ejecución en el
navegador.

## Beneficios esperados

- **Velocidad:** se automatizan casos en minutos en lugar de horas.
- **Menor barrera de entrada:** testers con experiencia funcional pueden automatizar sin ser
  programadores.
- **Más cobertura:** al automatizar más rápido, se cubren más casos de regresión.
- **Evidencia trazable:** cada ejecución deja reporte, capturas y video en caso de falla.
- **El conocimiento queda en el equipo:** los tests quedan versionados en el repositorio y
  se ejecutan en el pipeline de CI.

## Límites y controles

La IA **no reemplaza al tester**: el criterio de qué probar, qué es un defecto y si el
resultado es correcto sigue siendo humano. Para usarla de forma segura aplicamos estos
controles:

| Riesgo | Control |
|---|---|
| La IA genera un test incorrecto | Todo test se revisa y se ejecuta antes de subirlo al repositorio |
| Exposición de credenciales | Usuario y contraseña viven en un archivo `.env` local, que nunca se sube al repositorio |
| Datos sensibles enviados a un servicio externo | Se trabaja solo contra el ambiente de testing con datos de prueba, nunca con datos de producción |
| Cambios no controlados | Cada cambio queda en un commit separado, con versión y release registradas |

## Próximos pasos propuestos

1. Ampliar la cobertura: casos negativos de login y módulos Consultas, Estadísticas y Alarmas.
2. Configurar un runner interno para que los tests se ejecuten automáticamente en cada cambio.
3. Medir el tiempo de automatización por caso, con y sin IA, para cuantificar el beneficio.

> Antigravity se actualiza con frecuencia; las funciones y modelos disponibles pueden variar
> según la versión instalada.
