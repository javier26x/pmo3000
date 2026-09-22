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

Medido sobre el seed (`scripts/seed.ts`, 1.350 seguimientos):

|                                                |                    |
| ---------------------------------------------- | ------------------ |
| Documento de seguimiento completo              | **4,85 kB**        |
| De eso, el mapa de gates                       | **4,19 kB (86 %)** |
| El resto (referencias, denormalizados, estado) | 0,65 kB            |
| Traer 1.500 seguimientos                       | **7,1 MB**         |
| Los mismos 1.500 sin el mapa de gates          | **0,95 MB**        |

O sea: el 86 % de lo que viaja para pintar una tabla es un checklist que la
tabla no muestra. Eso tiene dos efectos medidos:

- Con ~5.800 documentos, el canal de escucha (`Listen`) falla con 400 y reintenta
  indefinidamente: la lista nunca carga.
- Con 1.350, el primer pintado tardaba ~8,5 s contra el emulador.

Por eso las consultas de seguimiento están **topadas en 1.500 documentos**
(`TOPE_SEGUIMIENTOS` en `src/data/repos/sitioProyectos.ts`) y, cuando se alcanza
el tope, la interfaz lo dice («Vista parcial») en vez de mostrar un subconjunto
silencioso. El recorte natural es filtrar por programa o proyecto, que es como
trabaja la PMO: con ~4.500 sitios repartidos en 3 programas, cada programa queda
en torno a 1.500.

### Mitigación en Fase 1: carga en dos tandas

Mientras el modelo no cambie, la app pide la misma consulta dos veces con topes
distintos: una primera tanda de 150 documentos (`TOPE_PRIMERA_TANDA`) y la
completa de 1.500. Se pinta con la que llegue primero y la completa la reemplaza.

Medido: el primer pintado pasó de **8,5 s a 4,3 s**, y mientras tanto el embudo
dice «cargando el resto…» para que nadie tome un conteo parcial por el total. El
costo son 150 lecturas extra por carga, que es barato comparado con 4 segundos de
esqueleto.

La caché persistente de Firestore (`persistentLocalCache`) hace además que la
segunda visita salga del disco.

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
