# 0003 — Las fechas de negocio se guardan como día civil, no como Timestamp

**Fecha:** 2026-09-21 · **Estado:** aceptada

## Contexto

La app maneja dos cosas que en código se parecen y en el negocio no:

- **Compromisos**: la fecha plan de un gate, la fecha real de cierre, la fecha
  comprometida de un riesgo. Son días del calendario. «El gate cierra el 15 de
  marzo» no tiene hora.
- **Sucesos**: cuándo se marcó un entregable, cuándo se registró un evento de
  auditoría. Son instantes.

## Decisión

- Los **compromisos** se guardan como texto `AAAA-MM-DD` (tipo `FechaISO`).
- Los **sucesos** se guardan como `Timestamp` de Firestore.

Toda la aritmética de días (`diasEntre`, `sumarDias`, `diasHabilesEntre`) se hace
con `Date.UTC` sobre esas cadenas, así que no depende de la zona horaria del
navegador. El formato de presentación es `dd-mm-aaaa`, y `hoyEnChile()` calcula
el día usando `America/Santiago`, no el reloj del dispositivo.

## Por qué

Un `Timestamp` guardado como «15 de marzo a medianoche UTC» se muestra en Chile
como **14 de marzo**. Un sitio que cerró a tiempo aparecería como atrasado, y el
scorecard del proveedor quedaría mal por un día. Ese error es silencioso y
difícil de rastrear cuando ya está repartido por toda la base.

Hay tests que fijan el comportamiento, incluidos los cruces del horario de verano
chileno (`src/domain/fechas/fechas.test.ts`).

## Consecuencias

- No se puede ordenar mezclando ambos tipos, pero como `AAAA-MM-DD` ordena
  lexicográficamente igual que cronológicamente, ordenar por texto funciona.
- Las consultas de rango sobre fechas plan (`where('fechaPlanGateActual','<',hoy)`)
  funcionan directamente sobre el texto.
- La importación tiene que convertir lo que venga (formato chileno, ISO, número
  de serie de Excel, objeto `Date`) a ese formato: lo hace
  `parsearFechaFlexible()`.
- El `<input type="date">` nativo usa el idioma del navegador para mostrar la
  fecha, aunque el valor que maneja sea `AAAA-MM-DD`. Por eso los campos de fecha
  muestran además la fecha ya formateada en chileno.
