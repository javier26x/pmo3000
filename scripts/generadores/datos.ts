/**
 * Datos de ejemplo ANONIMIZADOS.
 *
 * Nada aqui corresponde a un sitio, una persona ni un proveedor real: los
 * nombres de persona son "Letra Demo" con correo demo.*@claro.cl, los
 * proveedores son letras del alfabeto griego y los sitios se generan por
 * combinacion de palabras dentro de cajas de coordenadas de Chile.
 */
import { crearAleatorio, type Aleatorio } from './aleatorio'
import { PREFIJOS_SITIO, SUFIJOS_SITIO, TECNOLOGIAS, TIPOS_SITIO, ZONAS } from './geografia'

export interface SitioDemo {
  id: string
  nombre: string
  region: string
  comuna: string
  direccion: string
  lat: number
  lon: number
  tecnologias: string[]
  tipoSitio: string
}

export interface PersonaDemo {
  uid: string
  email: string
  password: string
  nombre: string
  rol: 'admin' | 'jefe_celula' | 'analista' | 'contratista' | 'lector'
  celulaId: string | null
  proveedorId: string | null
}

export const PASSWORD_DEMO = 'demo1234'

export const CELULAS_DEMO = [
  { id: 'cel-ingenieria', nombre: 'Ingenieria y diseno', color: 'indigo' },
  { id: 'cel-obra', nombre: 'Obra civil', color: 'ambar' },
  { id: 'cel-rf', nombre: 'RF e implementacion', color: 'violeta' },
  { id: 'cel-transmision', nombre: 'Transmision', color: 'cian' },
  { id: 'cel-permisos', nombre: 'Permisos y comunidades', color: 'verde' },
  { id: 'cel-calidad', nombre: 'Calidad y aceptacion', color: 'rosa' },
] as const

export const PROVEEDORES_DEMO = [
  { id: 'prov-alfa', nombre: 'Proveedor Alfa' },
  { id: 'prov-beta', nombre: 'Proveedor Beta' },
  { id: 'prov-gamma', nombre: 'Proveedor Gamma' },
  { id: 'prov-delta', nombre: 'Proveedor Delta' },
] as const

/** 13 personas: 1 admin, 6 jefes de celula, 4 analistas, 1 contratista, 1 lector. */
export const PERSONAS_DEMO: PersonaDemo[] = [
  {
    uid: 'demo-admin',
    email: 'demo.admin@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Ada Demo',
    rol: 'admin',
    celulaId: null,
    proveedorId: null,
  },
  {
    uid: 'demo-jefe-1',
    email: 'demo.jefe.ingenieria@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Bruno Demo',
    rol: 'jefe_celula',
    celulaId: 'cel-ingenieria',
    proveedorId: null,
  },
  {
    uid: 'demo-jefe-2',
    email: 'demo.jefe.obra@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Carla Demo',
    rol: 'jefe_celula',
    celulaId: 'cel-obra',
    proveedorId: null,
  },
  {
    uid: 'demo-jefe-3',
    email: 'demo.jefe.rf@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Diego Demo',
    rol: 'jefe_celula',
    celulaId: 'cel-rf',
    proveedorId: null,
  },
  {
    uid: 'demo-jefe-4',
    email: 'demo.jefe.transmision@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Elena Demo',
    rol: 'jefe_celula',
    celulaId: 'cel-transmision',
    proveedorId: null,
  },
  {
    uid: 'demo-jefe-5',
    email: 'demo.jefe.permisos@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Felipe Demo',
    rol: 'jefe_celula',
    celulaId: 'cel-permisos',
    proveedorId: null,
  },
  {
    uid: 'demo-jefe-6',
    email: 'demo.jefe.calidad@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Gabriela Demo',
    rol: 'jefe_celula',
    celulaId: 'cel-calidad',
    proveedorId: null,
  },
  {
    uid: 'demo-analista-1',
    email: 'demo.analista1@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Hugo Demo',
    rol: 'analista',
    celulaId: 'cel-ingenieria',
    proveedorId: null,
  },
  {
    uid: 'demo-analista-2',
    email: 'demo.analista2@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Ines Demo',
    rol: 'analista',
    celulaId: 'cel-obra',
    proveedorId: null,
  },
  {
    uid: 'demo-analista-3',
    email: 'demo.analista3@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Javier Demo',
    rol: 'analista',
    celulaId: 'cel-rf',
    proveedorId: null,
  },
  {
    uid: 'demo-analista-4',
    email: 'demo.analista4@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Karla Demo',
    rol: 'analista',
    celulaId: 'cel-calidad',
    proveedorId: null,
  },
  {
    uid: 'demo-contratista',
    email: 'demo.contratista.alfa@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Luis Demo',
    rol: 'contratista',
    celulaId: null,
    proveedorId: 'prov-alfa',
  },
  {
    uid: 'demo-lector',
    email: 'demo.lector@claro.cl',
    password: PASSWORD_DEMO,
    nombre: 'Marta Demo',
    rol: 'lector',
    celulaId: null,
    proveedorId: null,
  },
]

export const PORTAFOLIO_DEMO = {
  id: 'port-despliegue',
  nombre: 'Portafolio Despliegue 2026',
  descripcion: 'Programas de expansion y densificacion de la red movil.',
  periodo: '2026',
}

export const PROGRAMAS_DEMO = [
  {
    id: 'prog-plan200',
    nombre: 'Plan 200 sitios nuevos',
    descripcion: 'Construccion de 200 sitios greenfield en regiones prioritarias.',
    color: 'indigo',
    fechaInicio: '2026-01-06',
    fechaFin: '2026-12-18',
  },
  {
    id: 'prog-densificacion',
    nombre: 'Densificacion 5G',
    descripcion: 'Densificacion 5G en zonas de alta demanda.',
    color: 'violeta',
    fechaInicio: '2026-02-02',
    fechaFin: '2026-11-27',
  },
  {
    id: 'prog-expansion',
    nombre: 'Expansion regional sur',
    descripcion: 'Cobertura en localidades de la zona sur.',
    color: 'cian',
    fechaInicio: '2026-03-02',
    fechaFin: '2027-01-29',
  },
] as const

export const PROYECTOS_DEMO = [
  {
    id: 'proy-p200-rm',
    programaId: 'prog-plan200',
    nombre: 'Plan 200 - Metropolitana',
    celulaId: 'cel-obra',
    proveedorId: 'prov-alfa',
  },
  {
    id: 'proy-p200-norte',
    programaId: 'prog-plan200',
    nombre: 'Plan 200 - Norte',
    celulaId: 'cel-obra',
    proveedorId: 'prov-beta',
  },
  {
    id: 'proy-5g-centro',
    programaId: 'prog-densificacion',
    nombre: 'Densificacion - Centro',
    celulaId: 'cel-rf',
    proveedorId: 'prov-gamma',
  },
  {
    id: 'proy-5g-valpo',
    programaId: 'prog-densificacion',
    nombre: 'Densificacion - Valparaiso',
    celulaId: 'cel-rf',
    proveedorId: 'prov-alfa',
  },
  {
    id: 'proy-exp-sur',
    programaId: 'prog-expansion',
    nombre: 'Expansion - Los Lagos',
    celulaId: 'cel-transmision',
    proveedorId: 'prov-delta',
  },
  {
    id: 'proy-exp-araucania',
    programaId: 'prog-expansion',
    nombre: 'Expansion - Araucania',
    celulaId: 'cel-transmision',
    proveedorId: 'prov-beta',
  },
] as const

const PREFIJO_REGION: Record<string, string> = {
  'Metropolitana de Santiago': 'RM',
  Valparaiso: 'VAL',
  Biobio: 'BIO',
  Maule: 'MAU',
  Araucania: 'ARA',
  Antofagasta: 'ANT',
  'Los Lagos': 'LAG',
  Coquimbo: 'COQ',
}

export function generarSitios(cantidad: number, semilla = 20260921): SitioDemo[] {
  const rng: Aleatorio = crearAleatorio(semilla)
  const pesos = ZONAS.map((z) => z.peso)
  const sitios: SitioDemo[] = []
  const usados = new Set<string>()

  for (let i = 0; i < cantidad; i += 1) {
    const zona = ZONAS[rng.ponderado(pesos)]
    if (!zona) continue

    const prefijoRegion = PREFIJO_REGION[zona.region] ?? 'CL'
    const id = `${prefijoRegion}-${String(i + 1).padStart(4, '0')}`
    if (usados.has(id)) continue
    usados.add(id)

    const nombre = `${rng.elegir(PREFIJOS_SITIO)} ${rng.elegir(SUFIJOS_SITIO)} ${rng.entero(1, 99)}`
    const tecnologias = TECNOLOGIAS.slice(0, rng.entero(1, 3)).concat(
      rng.probabilidad(0.4) ? ['5G NSA'] : [],
    )

    sitios.push({
      id,
      nombre,
      region: zona.region,
      comuna: rng.elegir(zona.comunas),
      direccion: `Calle Ficticia ${rng.entero(100, 9999)}`,
      lat: Number(rng.decimal(zona.latMin, zona.latMax).toFixed(5)),
      lon: Number(rng.decimal(zona.lonMin, zona.lonMax).toFixed(5)),
      tecnologias: [...new Set(tecnologias)],
      tipoSitio: rng.elegir(TIPOS_SITIO),
    })
  }

  return sitios
}

export const TITULOS_TAREA = [
  'Coordinar visita tecnica con el propietario',
  'Revisar calculo estructural de la torre',
  'Solicitar factibilidad electrica a la distribuidora',
  'Cargar acta de recepcion de obra civil',
  'Agendar integracion con el centro de gestion',
  'Validar azimut y tilt contra el diseno',
  'Regularizar permiso municipal',
  'Levantar observaciones del drive test',
  'Actualizar inventario de activos del sitio',
  'Cerrar hallazgos de la medicion de tierra',
  'Confirmar ruta de fibra con transmision',
  'Reagendar cuadrilla por condiciones climaticas',
]
