/**
 * Vistas guardadas: un nombre para un conjunto de filtros.
 *
 * Se guardan en el navegador de cada persona y no en Firestore, a proposito:
 * son preferencias personales ("mis atrasados de Biobio"), no datos del
 * despliegue. Si mas adelante hiciera falta compartirlas, el contenido ya es un
 * texto de URL y mudarlas a Firestore es copiar el mismo string.
 */
export interface VistaGuardada {
  id: string
  nombre: string
  /** Query string de la URL, sin el signo de interrogacion. */
  consulta: string
  creadaEn: number
}

const CLAVE = 'pmo3000.vistas'
const MAXIMO = 20

function leerCrudo(): unknown {
  try {
    const texto = localStorage.getItem(CLAVE)
    return texto ? JSON.parse(texto) : []
  } catch {
    return []
  }
}

export function leerVistas(): VistaGuardada[] {
  const crudo = leerCrudo()
  if (!Array.isArray(crudo)) return []
  return crudo
    .filter(
      (v): v is VistaGuardada =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as VistaGuardada).id === 'string' &&
        typeof (v as VistaGuardada).nombre === 'string' &&
        typeof (v as VistaGuardada).consulta === 'string',
    )
    .slice(0, MAXIMO)
}

function escribir(vistas: VistaGuardada[]): VistaGuardada[] {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(vistas.slice(0, MAXIMO)))
  } catch {
    // Sin almacenamiento (modo privado): la vista vale para esta sesion y ya.
  }
  return vistas
}

export function guardarVista(nombre: string, consulta: string): VistaGuardada[] {
  const limpio = nombre.trim()
  if (!limpio) return leerVistas()

  const vistas = leerVistas()
  // Mismo nombre reemplaza: guardar dos veces "Atrasados" no debe dejar dos.
  const sinRepetida = vistas.filter((v) => v.nombre.toLowerCase() !== limpio.toLowerCase())

  return escribir([
    {
      id: `vista-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nombre: limpio,
      consulta,
      creadaEn: Date.now(),
    },
    ...sinRepetida,
  ])
}

export function borrarVista(id: string): VistaGuardada[] {
  return escribir(leerVistas().filter((v) => v.id !== id))
}
