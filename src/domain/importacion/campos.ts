/**
 * Definicion de las columnas que la app entiende al importar el maestro de
 * sitios, con los alias que se ven en las planillas reales de la PMO. El mapeo
 * se autodetecta con estos alias y el usuario siempre puede corregirlo a mano.
 */

export const CLAVES_IMPORTACION = [
  'id',
  'nombre',
  'region',
  'comuna',
  'direccion',
  'lat',
  'lon',
  'tecnologias',
  'tipoSitio',
  'programa',
  'proveedor',
  'fechaInicio',
] as const
export type ClaveImportacion = (typeof CLAVES_IMPORTACION)[number]

export interface CampoImportacion {
  clave: ClaveImportacion
  etiqueta: string
  obligatorio: boolean
  alias: readonly string[]
  ayuda: string
}

export const CAMPOS_IMPORTACION: readonly CampoImportacion[] = [
  {
    clave: 'id',
    etiqueta: 'ID de sitio',
    obligatorio: true,
    alias: ['id', 'idsitio', 'sitio', 'codigositio', 'codigo', 'siteid', 'site', 'idsite'],
    ayuda: 'Identificador unico del sitio. Es la llave del maestro.',
  },
  {
    clave: 'nombre',
    etiqueta: 'Nombre',
    obligatorio: true,
    alias: ['nombre', 'nombresitio', 'sitename', 'descripcion', 'name'],
    ayuda: 'Nombre del sitio tal como se usa en terreno.',
  },
  {
    clave: 'region',
    etiqueta: 'Region',
    obligatorio: true,
    alias: ['region', 'regionadministrativa', 'zona'],
    ayuda: 'Region administrativa.',
  },
  {
    clave: 'comuna',
    etiqueta: 'Comuna',
    obligatorio: true,
    alias: ['comuna', 'ciudad', 'localidad'],
    ayuda: 'Comuna del sitio.',
  },
  {
    clave: 'direccion',
    etiqueta: 'Direccion',
    obligatorio: false,
    alias: ['direccion', 'domicilio', 'calle', 'address'],
    ayuda: 'Direccion o referencia de acceso.',
  },
  {
    clave: 'lat',
    etiqueta: 'Latitud',
    obligatorio: true,
    alias: ['lat', 'latitud', 'latitude', 'y'],
    ayuda: 'Latitud en grados decimales. Acepta coma o punto decimal.',
  },
  {
    clave: 'lon',
    etiqueta: 'Longitud',
    obligatorio: true,
    alias: ['lon', 'lng', 'long', 'longitud', 'longitude', 'x'],
    ayuda: 'Longitud en grados decimales. Acepta coma o punto decimal.',
  },
  {
    clave: 'tecnologias',
    etiqueta: 'Tecnologias',
    obligatorio: false,
    alias: ['tecnologias', 'tecnologia', 'tech', 'banda', 'bandas'],
    ayuda: 'Separadas por coma, punto y coma o barra. Ej: 4G/5G.',
  },
  {
    clave: 'tipoSitio',
    etiqueta: 'Tipo de sitio',
    obligatorio: false,
    alias: ['tiposition', 'tipositio', 'tipo', 'tipoestructura', 'sitetype'],
    ayuda: 'Greenfield, rooftop, monopolo, etc.',
  },
  {
    clave: 'programa',
    etiqueta: 'Programa',
    obligatorio: false,
    alias: ['programa', 'proyecto', 'plan', 'program', 'iniciativa'],
    ayuda: 'Si viene, el sitio se incorpora al seguimiento de ese programa.',
  },
  {
    clave: 'proveedor',
    etiqueta: 'Proveedor',
    obligatorio: false,
    alias: ['proveedor', 'contratista', 'empresa', 'vendor', 'supplier'],
    ayuda: 'Empresa responsable del despliegue del sitio.',
  },
  {
    clave: 'fechaInicio',
    etiqueta: 'Fecha de inicio',
    obligatorio: false,
    alias: ['fechainicio', 'inicio', 'fechaplan', 'startdate', 'fecha'],
    ayuda: 'Desde esta fecha se calculan las fechas plan de cada gate.',
  },
]

export const CAMPOS_POR_CLAVE: Record<ClaveImportacion, CampoImportacion> = Object.fromEntries(
  CAMPOS_IMPORTACION.map((c) => [c.clave, c]),
) as Record<ClaveImportacion, CampoImportacion>

export const CLAVES_OBLIGATORIAS: readonly ClaveImportacion[] = CAMPOS_IMPORTACION.filter(
  (c) => c.obligatorio,
).map((c) => c.clave)
