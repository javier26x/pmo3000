# 0001 — Maestro de sitios separado de la participación en proyectos

**Fecha:** 2026-09-21 · **Estado:** aceptada

## Contexto

Un sitio físico puede participar en más de un programa a lo largo del tiempo:
primero se construye en «Plan 200», y un año después el mismo sitio entra a
«Densificación 5G» con otro proveedor, otras fechas y otro ciclo de gates.

La alternativa simple era guardar los gates en el documento del sitio.

## Decisión

Dos colecciones:

- **`sitios/{sitioId}`** — el maestro físico: coordenadas, comuna, tecnologías.
  Es inmutable en lo esencial y el id del documento es el ID de sitio real.
- **`sitioProyectos/{proyectoId__sitioId}`** — la participación de ese sitio en
  un proyecto: ahí viven `gateActual`, las fechas plan/real, el checklist, el
  responsable y el proveedor.

## Consecuencias

**A favor**

- El mismo sitio puede estar en varios programas sin duplicarse ni perder su
  histórico anterior.
- Los dos ids son deterministas, así que reimportar una planilla actualiza en
  vez de duplicar.
- La tabla y el mapa consultan una sola colección, con los datos del sitio
  desnormalizados (`sitioNombre`, `region`, `comuna`, `lat`, `lon`) para no
  necesitar join.

**En contra**

- Hay que mantener esa desnormalización cuando cambia el maestro. Hoy solo
  cambia al importar o al editar el sitio; en la Fase 2 lo hará una Cloud
  Function.
- La ficha de sitio necesita dos consultas: el maestro y sus participaciones.

## Alternativa descartada

Gates dentro del documento del sitio. Más simple de consultar, pero reusar el
sitio en otro programa obligaba a duplicarlo o a perder el avance anterior — que
es justamente el histórico que la PMO necesita para el scorecard de proveedores.
