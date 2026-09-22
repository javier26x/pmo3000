/**
 * Geografia ficticia pero plausible: regiones y comunas reales de Chile (son
 * division administrativa publica, no dato sensible) con cajas de coordenadas
 * aproximadas. Los SITIOS que se generan dentro son inventados.
 */
export interface ZonaGeografica {
  region: string
  comunas: string[]
  latMin: number
  latMax: number
  lonMin: number
  lonMax: number
  peso: number
}

export const ZONAS: ZonaGeografica[] = [
  {
    region: 'Metropolitana de Santiago',
    comunas: ['Maipu', 'Puente Alto', 'La Florida', 'Renca', 'Quilicura', 'Penalolen', 'Melipilla'],
    latMin: -33.85,
    latMax: -33.25,
    lonMin: -71.1,
    lonMax: -70.45,
    peso: 34,
  },
  {
    region: 'Valparaiso',
    comunas: ['Valparaiso', 'Vina del Mar', 'Quilpue', 'San Antonio', 'La Ligua', 'Quillota'],
    latMin: -33.6,
    latMax: -32.3,
    lonMin: -71.7,
    lonMax: -70.9,
    peso: 14,
  },
  {
    region: 'Biobio',
    comunas: ['Concepcion', 'Talcahuano', 'Los Angeles', 'Chiguayante', 'Coronel'],
    latMin: -37.9,
    latMax: -36.6,
    lonMin: -73.2,
    lonMax: -71.8,
    peso: 12,
  },
  {
    region: 'Maule',
    comunas: ['Talca', 'Curico', 'Linares', 'Constitucion', 'Cauquenes'],
    latMin: -36.3,
    latMax: -34.8,
    lonMin: -72.6,
    lonMax: -70.9,
    peso: 9,
  },
  {
    region: 'Araucania',
    comunas: ['Temuco', 'Villarrica', 'Angol', 'Padre Las Casas', 'Pucon'],
    latMin: -39.6,
    latMax: -37.6,
    lonMin: -73.3,
    lonMax: -71.3,
    peso: 9,
  },
  {
    region: 'Antofagasta',
    comunas: ['Antofagasta', 'Calama', 'Tocopilla', 'Mejillones'],
    latMin: -25.6,
    latMax: -22.2,
    lonMin: -70.6,
    lonMax: -68.3,
    peso: 8,
  },
  {
    region: 'Los Lagos',
    comunas: ['Puerto Montt', 'Osorno', 'Castro', 'Puerto Varas', 'Ancud'],
    latMin: -43.0,
    latMax: -40.3,
    lonMin: -74.0,
    lonMax: -71.9,
    peso: 8,
  },
  {
    region: 'Coquimbo',
    comunas: ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel', 'Vicuna'],
    latMin: -32.2,
    latMax: -29.2,
    lonMin: -71.7,
    lonMax: -70.3,
    peso: 6,
  },
]

/** Palabras para armar nombres de sitio inventados. */
export const PREFIJOS_SITIO = [
  'Cerro',
  'Loma',
  'Parque',
  'Mirador',
  'Alto',
  'Bajo',
  'Estero',
  'Quebrada',
  'Llano',
  'Paso',
  'Vega',
  'Costa',
]

export const SUFIJOS_SITIO = [
  'Azul',
  'Verde',
  'Norte',
  'Sur',
  'Oriente',
  'Poniente',
  'Central',
  'Antiguo',
  'Nuevo',
  'Claro',
  'Hondo',
  'Ancho',
]

export const TIPOS_SITIO = ['Greenfield', 'Rooftop', 'Monopolo', 'Torre autosoportada', 'Mastil']

export const TECNOLOGIAS = ['2G', '3G', '4G', '4G+', '5G NSA', '5G SA']
