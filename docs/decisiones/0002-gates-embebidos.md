# 0002 — Gates embebidos en el documento de seguimiento

**Fecha:** 2026-09-21 · **Estado:** aceptada, con un límite medido

## Contexto

Cada seguimiento tiene 7 gates, y cada gate entre 3 y 5 entregables con su estado,
observación, evidencia y quién lo marcó. Había que decidir si eso vive dentro del
documento o en una subcolección.

## Decisión

Un mapa `gates` embebido en `sitioProyectos/{id}`.

Razones:

- La ficha de sitio —la pantalla que más se abre— se lee con **1 lectura** en vez
  de 8.
- El `orden` de cada gate queda dentro del documento, lo que permite validar la
  secuencia en `firestore.rules` **sin un `get()` adicional**.
- 7 gates × ~10 entregables entran cómodamente en el límite de 1 MiB por
  documento (el documento real pesa ~5 kB).

## Consecuencias

El documento pesa ~5 kB, y eso tiene un costo medible al **listar**: escuchar la
colección completa significa descargar decenas de megas y mantenerlos en memoria.

Medido contra el emulador de Firestore: con ~5.800 documentos de seguimiento, el
canal de escucha (`Listen`) falla con 400 y reintenta indefinidamente; la lista
nunca carga.

Por eso las consultas de seguimiento están **topadas en 1.500 documentos**
(`TOPE_SEGUIMIENTOS` en `src/data/repos/sitioProyectos.ts`) y, cuando se alcanza
el tope, la interfaz lo dice («Vista parcial») en vez de mostrar un subconjunto
silencioso. El recorte natural es filtrar por programa o proyecto, que es como
trabaja la PMO: con ~4.500 sitios repartidos en 3 programas, cada programa queda
en torno a 1.500.

## Si hace falta más

Si un solo programa supera ese volumen, la salida es mover los gates a una
subcolección `sitioProyectos/{id}/gates/{codigo}`:

- el documento padre baja a ~500 B y las listas dejan de ser el problema;
- la ficha pasa a costar 8 lecturas en vez de 1;
- **y las reglas pierden capacidad**: hoy validan la consistencia del cierre
  mirando `request.resource.data.gates[origen()]` dentro de la misma escritura.
  Con el gate en otro documento, las reglas solo podrían leer el estado ya
  confirmado, no el que viene en el lote.

Por eso el cambio conviene hacerlo junto con las Cloud Functions de la Fase 2,
que es donde esa validación se puede hacer del lado del servidor de todos modos.
