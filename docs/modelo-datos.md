# Modelo de datos

Diseñado para las tres fases, aunque la Fase 1 solo implemente una parte. Las
colecciones marcadas **[F2]** y **[F3]** ya están contempladas en las reglas de
seguridad y en los tipos de `src/domain/tipos/`.

Todas las colecciones son raíz (planas). Eso permite filtrar por programa,
proveedor o célula sin recorrer jerarquías, que es como consulta la PMO.

## Convenciones

- **Fechas de negocio** (plan/real de gate, compromiso de un riesgo):
  texto `AAAA-MM-DD`. No son instantes, son días civiles chilenos.
- **Sellos de sistema** (`creadoEn`, `actualizadoEn`, `ts`): `Timestamp`.
- **Referencias**: se guarda el id como string, nunca un `DocumentReference`
  (sobreviven mejor a exportar/importar y se leen igual en la consola).

---

## Organización y personas

### `usuarios/{uid}` [F1]

El id del documento es el UID de Firebase Auth.

| Campo          | Tipo                                                                | Notas                                      |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `email`        | string                                                              | siempre en minúsculas                      |
| `nombre`       | string                                                              |                                            |
| `rol`          | `admin` \| `jefe_celula` \| `analista` \| `contratista` \| `lector` |                                            |
| `celulaId`     | string \| null                                                      |                                            |
| `proveedorId`  | string \| null                                                      | **obligatorio** si el rol es `contratista` |
| `alcance`      | `{ celulas: string[], programas: string[], proyectos: string[] }`   | ver abajo; ausente = listas vacías         |
| `activo`       | boolean                                                             | desactivar en vez de borrar                |
| `ultimoAcceso` | Timestamp \| null                                                   |                                            |

Sin Cloud Functions no hay _custom claims_: el rol vive aquí y las reglas lo leen
con `get()`.

**`alcance`** acota lo que un usuario no admin ve y edita del seguimiento: un
`sitioProyecto` le es visible si su `celulaId` está en `celulas`, **o** su
`programaId` en `programas`, **o** su `proyectoId` en `proyectos`. Las tres
listas vacías (o el campo ausente, en perfiles anteriores) significan «sin
restricción». Al admin nunca se le aplica. Tope: 30 entradas sumando las tres
listas (lo que admite un `or()` de Firestore). Solo lo escribe un admin, desde
Usuarios y roles; el alta de un perfil lo crea vacío. Las reglas lo imponen:
ver [reglas-seguridad.md](reglas-seguridad.md#perfiles-acotados-alcance).

### `celulas/{id}` [F1]

`nombre`, `descripcion`, `liderUid`, `color`, `activa`.

### `proveedores/{id}` [F1]

`nombre`, `contactoNombre`, `contactoEmail`, `activo`.

---

## Jerarquía

```
portafolios → programas → proyectos → sitioProyectos → (sitios)
```

### `portafolios/{id}` [F1]

`nombre`, `descripcion`, `responsableUid`, `periodo`, `activo`.

### `programas/{id}` [F1]

`portafolioId`, `nombre`, `descripcion`, `gateTemplateId`, `fechaInicio`,
`fechaFin`, `estado`, `responsableUid`, `color`.

### `proyectos/{id}` [F1]

`programaId`, `portafolioId`, `nombre`, `descripcion`, `celulaId`,
`proveedorId`, `responsableUid`, `fechaInicio`, `fechaFin`, `estado`.

---

## Sitios: maestro y participación

La decisión central del modelo: **el sitio físico y su avance son cosas
distintas**. Un mismo sitio puede participar en varios programas a lo largo del
tiempo (primero «Plan 200», después «Densificación 5G»), cada uno con sus propios
gates y fechas.

### `sitios/{sitioId}` [F1] — maestro físico

El id del documento **es** el ID de sitio real (`RM-0421`). Eso hace que la
importación sea idempotente: reimportar la misma planilla actualiza, no duplica.

| Campo                                                  | Tipo                                                |
| ------------------------------------------------------ | --------------------------------------------------- |
| `nombre`, `region`, `comuna`, `direccion`, `tipoSitio` | string                                              |
| `lat`, `lon`                                           | number                                              |
| `tecnologias`                                          | string[]                                            |
| `carpetaUrl`                                           | string \| null (URL de SharePoint, editable a mano) |
| `activo`                                               | boolean                                             |

### `sitioProyectos/{proyectoId__sitioId}` [F1] — participación

El id es compuesto, así que también es idempotente. Aquí viven los gates.

**Referencias:** `sitioId`, `proyectoId`, `programaId`, `portafolioId`,
`celulaId`, `proveedorId`, `responsableUid`.

**Desnormalizado desde el maestro** (para que la tabla y el mapa no necesiten
join): `sitioNombre`, `region`, `comuna`, `lat`, `lon`.

**Estado:** `gateActual` (`TSSR`…`SSV` \| `CERRADO`), `estadoGate`
(`no_iniciado` \| `en_curso` \| `bloqueado` \| `completado`), `bloqueado`,
`motivoBloqueo`, `prioridad`.

**`fechaPlanGateActual`** — copia de `gates[gateActual].fechaPlan`. Permite
consultar los atrasados con `where('fechaPlanGateActual','<',hoy)` sin un campo
calculado que envejezca: en la Fase 1 no hay ningún proceso nocturno que
recalcule nada.

**`gates`** — mapa embebido, una entrada por gate:

```jsonc
"gates": {
  "TSSR": {
    "orden": 0,
    "estado": "en_curso",
    "fechaPlan": "2026-03-01",
    "fechaReal": null,
    "fechaBaseline": null,        // la llena el Gantt en Fase 2
    "responsableUid": "…",
    "proveedorId": "…",
    "checklist": {
      "tssr-informe": {
        "ok": true,
        "obs": "",
        "evidenciaUrl": "https://…",
        "por": "uid",
        "en": "<Timestamp>"
      }
    },
    "completadoEn": null,
    "completadoPor": null
  }
}
```

**Plantilla:** `gateTemplateId`, `gateTemplateVersion`. La plantilla se _instancia_
(se copia) al crear el seguimiento, así cambiarla después no reescribe el
histórico de los sitios que ya avanzaron con la versión anterior.

### `sitioProyectos/{id}/comentarios/{id}` [F1]

`texto`, `uid`, `nombre`, `gateCodigo`, `ts`. No se editan ni se borran: son
parte del historial.

### `gateTemplates/{id}` [F1]

```jsonc
{
  "nombre": "Despliegue estandar",
  "version": 1,
  "activo": true,
  "gates": [
    {
      "codigo": "TSSR",
      "nombre": "TSSR",
      "orden": 0,
      "slaDias": 15,
      "checklist": [
        { "id": "tssr-informe", "texto": "…", "obligatorio": true, "requiereEvidencia": true },
      ],
    },
  ],
}
```

---

## Trabajo

### `tareas/{id}` [F1]

`titulo`, `descripcion`, `estado`, `asignadoUid`, `celulaId`, `sitioId`,
`sitioProyectoId`, `proyectoId`, `programaId`, `gateCodigo`, `prioridad`,
`fechaInicio`, `fechaVencimiento`, `estimacionHoras`, `orden`, `etiquetas`,
`dependencias`.

Una tarea puede colgar de un sitio o ser trabajo de célula sin sitio.

`orden` es flotante: reordenar una tarjeta del kanban es **un solo write**, no
reescribir la columna completa (ver `ordenEntre()` en `domain/tipos/tarea.ts`).

`dependencias` (`[{ tareaId, tipo: FS|SS|FF|SF, lagDias }]`) se crea vacío en la
Fase 1 y lo consume el Gantt en la Fase 2.

### `hitos/{id}` [F2]

`proyectoId`, `programaId`, `nombre`, `fechaPlan`, `fechaReal`, `critico`.

### `baselines/{id}` [F2]

`alcance` (`programa`|`proyecto`), `refId`, `version`, `nombre`, `congeladaEn`,
`congeladaPor`, `items: [{ refTipo, refId, inicio, fin }]`.

---

## Gobierno

### `auditoria/{id}` [F1] — append-only

| Campo                                             | Notas                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `entidadTipo`, `entidadId`                        | qué se tocó                                                                                            |
| `sitioId`, `proyectoId`, `programaId`             | contexto desnormalizado, para filtrar el log sin joins                                                 |
| `accion`                                          | `crear`, `actualizar`, `eliminar`, `cambio_gate`, `retroceso_gate`, `checklist`, `importar`, `asignar` |
| `campo`, `valorAnterior`, `valorNuevo`, `detalle` | el cambio en sí                                                                                        |
| `uid`, `email`, `nombre`                          | quién                                                                                                  |
| `ts`                                              | cuándo — las reglas exigen `serverTimestamp()`, no se puede antedatar                                  |
| `origen`                                          | `ui` \| `import` \| `seed`                                                                             |

Las reglas prohíben `update` y `delete` **a todos los roles**. Corregir el
historial solo se puede haciendo un evento nuevo.

Una importación escribe **un** evento con el resumen, no uno por fila: 4.500
eventos no le sirven a nadie y reventarían el lote.

### `raid/{id}` [F2]

`tipo` (`riesgo`|`accion`|`issue`|`decision`), `titulo`, `descripcion`,
`severidad` 1-5, `probabilidad`, `impacto`, `estado`, `duenoUid`,
`fechaCompromiso`, `fechaCierre`, `sitioId`, `proyectoId`, `programaId`,
`proveedorId`, `escalamientos: [{ nivel, aUid, aNombre, fecha, motivo, porUid }]`.

### `solicitudesCarpeta/{id}` [F2]

Registro del correo generado para Power Automate: `sitioId`, `programaId`,
`asunto`, `cuerpo`, `generadoPor`, `generadoEn`, `estado`, `carpetaUrl`.

### `plantillasReporte/{id}` [F2]

Configuración del PPT: logo, colores, secciones.

### `scorecards/{periodo__proveedorId}` [F3]

Agregados de cumplimiento por proveedor, escritos por una Cloud Function.

### `kpiSemanal/{programaId__semana}` [F3]

Snapshot para la tendencia del dashboard ejecutivo.

### `config/app` [F1]

`dominioPermitido`, `asuntoCarpeta`, `umbralSobrecargaTareas`.

---

## Índices

En `firestore.indexes.json`. Se despliegan con `npm run deploy:rules`.

Las consultas de `sitioProyectos` usan **solo filtros de igualdad y sin
`orderBy`**: Firestore las resuelve combinando índices de campo único, así que no
hace falta un índice compuesto por cada mezcla de filtros. El orden, la búsqueda
por texto y el filtro de atrasados se hacen en el cliente sobre el conjunto ya
acotado (ver `src/domain/vistas/filtrado.ts`).

Los índices compuestos declarados son para las consultas que **sí** combinan
igualdad con orden:

| Colección        | Campos                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `auditoria`      | (`entidadId`, `ts` desc) · (`sitioId`, `ts` desc) · (`programaId`, `ts` desc) · (`uid`, `ts` desc)         |
| `sitioProyectos` | (`programaId`, `gateActual`, `fechaPlanGateActual`) · (`proveedorId`, `gateActual`, `fechaPlanGateActual`) |
| `tareas`         | (`celulaId`, `estado`, `orden`) · (`asignadoUid`, `estado`, `orden`)                                       |

## Lectura tolerante

Los normalizadores de `src/data/normalizadores.ts` **no** usan Zod: en una tabla
de miles de filas, un parse por documento se nota. Zod se usa donde importa la
corrección del dato —formularios e importación— y en la escritura, que son pocos
documentos. En la lectura preferimos ser tolerantes: un campo ausente toma su
valor por defecto en vez de romper la pantalla completa.
