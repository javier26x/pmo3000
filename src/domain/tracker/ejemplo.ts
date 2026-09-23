/**
 * Tracker de ejemplo, para quien llega sin planilla propia.
 *
 * No es un formato que la app exija: el importador deduce la plantilla de
 * cualquier tracker (ver inferencia.ts). Es una planilla chica armada con las
 * mismas convenciones que los trackers reales, para que quien parte de cero
 * tenga de donde copiar:
 *
 * - Columnas del sitio primero (ID, nombre, ubicacion, plan, vigencia).
 * - Despues un bloque por etapa, de izquierda a derecha en el orden del proceso.
 * - Dentro de cada etapa, "Status <etapa> <disciplina>" por cada disciplina que
 *   revisa, con su comentario y su fecha al lado.
 * - Al final los requisitos paralelos (contrato, transmision) y la fecha On Air.
 *
 * Las filas cubren los casos que la app distingue: sitio recien entrado,
 * observado, en construccion, en servicio, en espera y fuera del plan. Las
 * pruebas de ejemplo.test.ts leen esta misma planilla con el importador, asi
 * que si la inferencia cambia y el ejemplo deja de importarse bien, se nota.
 */

const d = (iso: string) => new Date(`${iso}T12:00:00Z`)

export const ENCABEZADO_EJEMPLO = [
  'ID Sitio',
  'Site Name',
  'Latitud',
  'Longitud',
  'Región',
  'Comuna',
  'Dirección',
  'Proyecto',
  'Vigencia',
  'Colo/BTS',
  // TSS
  'Presentación TSS',
  'Status TSS RF',
  'Comentarios TSS RF',
  'TSS Fecha de Aprobación RF',
  'Status TSS ECE',
  'Comentarios TSS ECE',
  'TSS Fecha de Aprobación ECE',
  // Ingenieria
  'Presentación Ing',
  'Status Ing RF',
  'Comentarios Ing RF',
  'Ing Fecha de Aprobación RF',
  'Status Ing OOCC',
  'Comentarios Ing OOCC',
  'Ing Fecha de Aprobación OOCC',
  // Construccion
  'Estado Construcción',
  'Comentarios Construcción',
  'Fecha Fin Construcción',
  // As Built
  'Status As Built',
  'Fecha As Built',
  // Paralelas
  'Status Contrato',
  'Tipo Tx',
  // Hito final
  'Fecha Sitio On Air',
] as const

type Fila = unknown[]

// prettier-ignore
const FILAS: Fila[] = [
  // En servicio: todo cerrado.
  [
    'EJ_001', 'Plaza Norte', -33.3651, -70.6789, 'Metropolitana de Santiago', 'HUECHURABA',
    'Av. Américo Vespucio 1737', 'Plan 2026', 'Vigente', 'BTS',
    d('2026-01-12'), 'TSS Aprobado', '', d('2026-01-20'), 'TSS Aprobado', '', d('2026-01-22'),
    d('2026-02-02'), 'Ing Aprobada', '', d('2026-02-10'), 'Ing Aprobada', '', d('2026-02-12'),
    'Finalizada', '', d('2026-04-15'),
    'Aprobado', d('2026-04-30'),
    'Firmado', 'Fibra',
    d('2026-05-08'),
  ],
  // En As Built.
  [
    'EJ_002', 'Cerro Alegre', -33.0433, -71.6275, 'Valparaíso', 'VALPARAISO',
    'Calle Templeman 250', 'Plan 2026', 'Vigente', 'COLO',
    d('2026-01-19'), 'TSS Aprobado', '', d('2026-01-28'), 'TSS Aprobado con Observaciones',
    'Validar capacidad del tablero', d('2026-01-29'),
    d('2026-02-16'), 'Ing Aprobada', '', d('2026-02-25'), 'Ing Aprobada', '', d('2026-02-27'),
    'Finalizada', '', d('2026-05-20'),
    'En Revisión', null,
    'Firmado', 'Microondas',
    null,
  ],
  // En construccion.
  [
    'EJ_003', 'Lomas de Concepción', -36.8201, -73.0444, 'Biobío', 'CONCEPCION',
    'Los Carrera 1450', 'Plan 2026', 'Vigente', 'BTS',
    d('2026-02-03'), 'TSS Aprobado', '', d('2026-02-11'), 'TSS Aprobado', '', d('2026-02-12'),
    d('2026-03-02'), 'Ing Aprobada', '', d('2026-03-10'), 'Ing Aprobada', '', d('2026-03-13'),
    'En Curso', 'Montaje de torre al 60%', null,
    '', null,
    'Firmado', 'Fibra',
    null,
  ],
  // Ingenieria observada por OOCC.
  [
    'EJ_004', 'Puerto Montt Centro', -41.4693, -72.9424, 'Los Lagos', 'PUERTO MONTT',
    'Antonio Varas 525', 'Plan 2026', 'Vigente', 'BTS',
    d('2026-02-20'), 'TSS Aprobado', '', d('2026-03-02'), 'TSS Aprobado', '', d('2026-03-03'),
    d('2026-03-23'), 'Ing Aprobada', '', d('2026-04-01'), 'Ing Observada',
    'Falta memoria de cálculo de la losa', d('2026-04-03'),
    '', '', null,
    '', null,
    'En Revisión', 'Fibra',
    null,
  ],
  // Ingenieria en revision.
  [
    'EJ_005', 'La Serena Faro', -29.9045, -71.2489, 'Coquimbo', 'LA SERENA',
    'Av. del Mar 3200', 'Plan 2026', 'Vigente', 'COLO',
    d('2026-03-09'), 'TSS Aprobado', '', d('2026-03-17'), 'TSS Aprobado', '', d('2026-03-18'),
    d('2026-04-13'), 'Ing En Revisión', '', null, 'Ing En Revisión', '', null,
    '', '', null,
    '', null,
    'Firmado', 'Microondas',
    null,
  ],
  // TSS rechazado por RF.
  [
    'EJ_006', 'Temuco Estación', -38.7359, -72.5904, 'La Araucanía', 'TEMUCO',
    'Barros Arana 191', 'Plan 2026', 'Vigente', 'BTS',
    d('2026-04-06'), 'TSS Rechazado', 'Cobertura no cumple el objetivo, buscar otra ubicación',
    d('2026-04-14'), 'TSS Aprobado', '', d('2026-04-15'),
    null, '', '', null, '', '', null,
    '', '', null,
    '', null,
    'Pendiente', '',
    null,
  ],
  // Recien entrado al plan: nada presentado.
  [
    'EJ_007', 'Antofagasta Costanera', -23.6509, -70.3975, 'Antofagasta', 'ANTOFAGASTA',
    'Av. Grecia 1890', 'Plan 2026', 'Vigente', 'BTS',
    null, 'TSS No Recibido', '', null, 'TSS No Recibido', '', null,
    null, '', '', null, '', '', null,
    '', '', null,
    '', null,
    'Pendiente', '',
    null,
  ],
  // En espera: el plan lo marca On Hold.
  [
    'EJ_008', 'Rancagua Sur', -34.1848, -70.7406, "Libertador General Bernardo O'Higgins",
    'RANCAGUA', 'Carretera del Cobre 480', 'Plan 2026 - On Hold', 'Vigente', 'COLO',
    d('2026-02-09'), 'TSS Aprobado', '', d('2026-02-17'), 'TSS Aprobado', '', d('2026-02-18'),
    null, '', 'Detenido por negociación con el arrendador', null, '', '', null,
    '', '', null,
    '', null,
    'Detenido', '',
    null,
  ],
  // Salio del plan.
  [
    'EJ_009', 'Arica Chinchorro', -18.4604, -70.3059, 'Arica y Parinacota', 'ARICA',
    'Av. Luis Beretta Porcel 2100', 'Plan 2026', 'No Vigente', 'BTS',
    d('2026-01-26'), 'TSS Observado', 'Sitio sale del plan', d('2026-02-03'), '', '', null,
    null, '', '', null, '', '', null,
    '', '', null,
    '', null,
    '', '',
    null,
  ],
]

/** La hoja del tracker completa: encabezado y filas. */
export function filasTrackerEjemplo(): unknown[][] {
  return [[...ENCABEZADO_EJEMPLO], ...FILAS.map((f) => [...f])]
}

/** Segunda hoja del libro: como se lee y como se adapta. */
export const INSTRUCCIONES_EJEMPLO: string[][] = [
  ['Tracker de ejemplo de PMO3000'],
  [''],
  ['Cómo está armado'],
  ['1. Una fila por sitio. La columna "ID Sitio" es obligatoria y no se repite.'],
  ['2. Primero van los datos del sitio: nombre, ubicación, plan ("Proyecto") y "Vigencia".'],
  ['3. Después, un bloque por etapa, de izquierda a derecha en el orden del proceso.'],
  ['4. Cada revisión es una columna "Status <etapa> <disciplina>", por ejemplo "Status Ing OOCC".'],
  ['   Su comentario y su fecha van al lado y mencionan la misma etapa y disciplina.'],
  ['5. Una etapa sin disciplinas lleva una sola columna "Status <etapa>" o "Estado <etapa>".'],
  ['6. "Fecha Sitio On Air" marca el sitio en servicio.'],
  [''],
  ['Cómo adaptarlo'],
  ['- Renombra, agrega o quita etapas y disciplinas: la app deduce el proceso de los encabezados.'],
  ['- Los estados se escriben en texto libre ("TSS Aprobado", "Ing Observada", "En Curso").'],
  [
    '- Borra las filas de ejemplo y pega tus sitios. Al importar revisas la propuesta antes de guardar.',
  ],
]
