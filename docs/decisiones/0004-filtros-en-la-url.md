# 0004 — Los filtros viven en la URL, no en un store

**Fecha:** 2026-09-22 · **Estado:** aceptada

## Contexto

La tabla, el mapa y el kanban comparten el mismo recorte: programa, proyecto,
gate, proveedor, célula, región, comuna, prioridad, texto de búsqueda, atrasados,
bloqueados y el orden. La primera versión lo guardaba en un store de Zustand.

## Decisión

El estado de filtrado vive **solo en la query string** (`useFiltros`, que se
apoya en `useSearchParams`). No hay store paralelo.

La codificación es pura y está probada (`src/app/filtrosUrl.ts` y su test): claves
cortas y legibles (`?prog=…&gate=FC&atr=1`), sin serializar lo que está en su
valor por defecto.

## Por qué

Tres cosas que en una herramienta de trabajo se piden siempre salen gratis:

1. **Compartir una vista pegando el enlace.** «Mira los atrasados del Plan 200 en
   Biobío» deja de ser una instrucción y pasa a ser un link.
2. **Recargar sin perder el trabajo de filtrado.**
3. **Que el botón Atrás deshaga el último filtro**, que es lo que la gente espera
   de un navegador.

Y evita el problema de fondo de la versión anterior: dos fuentes de verdad (store
y URL) que tarde o temprano se desincronizan.

## Consecuencias

- Escribir en el buscador reemplaza la entrada del historial (`replace`) para no
  dejar una por letra; los filtros discretos la empujan (`push`) para que Atrás
  los deshaga de a uno.
- Saltar entre tabla, mapa y kanban conserva la query: son tres miradas del mismo
  recorte, no tres pantallas distintas.
- Las vistas guardadas (`src/app/vistas.ts`) son simplemente un nombre y una query
  string en el navegador de cada persona. Si algún día hay que compartirlas, el
  contenido ya es un string listo para mudar a Firestore.
- El filtro de gate se aplica en el cliente y no en el servidor: si se recortara
  en la consulta, el embudo se quedaría con una sola barra al seleccionar un gate
  y perdería justo el contexto que lo hace útil.
