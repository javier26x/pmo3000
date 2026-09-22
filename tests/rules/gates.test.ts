import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  PERFILES,
  como,
  crearEntorno,
  gatesDePrueba,
  marcaServidor,
  sembrarBase,
  seguimientoDePrueba,
} from './ayudas'

let entorno: RulesTestEnvironment
const RUTA = 'sitioProyectos/proy-1__SITIO-1'
const RUTA_BETA = 'sitioProyectos/proy-2__SITIO-1'

beforeAll(async () => {
  entorno = await crearEntorno()
})

afterAll(async () => {
  await entorno.cleanup()
})

beforeEach(async () => {
  await entorno.clearFirestore()
  await sembrarBase(entorno)
})

/** Deja el seguimiento en un gate dado, para probar avances y retrocesos. */
async function ponerEnGate(gate: string): Promise<void> {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(RUTA)
      .set(seguimientoDePrueba({ gateActual: gate, gates: gatesDePrueba({ gateActual: gate }) }))
  })
}

/** Avance bien formado: cierra el gate de origen y abre el siguiente. */
function avance(desde: string, hacia: string): Record<string, unknown> {
  return {
    gateActual: hacia,
    estadoGate: 'en_curso',
    [`gates.${desde}.estado`]: 'completado',
    [`gates.${desde}.fechaReal`]: '2026-03-05',
  }
}

describe('secuencia de gates', () => {
  it('permite avanzar al gate inmediatamente siguiente', async () => {
    await assertSucceeds(como(entorno, PERFILES.analista!).doc(RUTA).update(avance('TSSR', 'FC')))
  })

  it('rechaza saltarse gates', async () => {
    const db = como(entorno, PERFILES.analista!)
    await assertFails(db.doc(RUTA).update(avance('TSSR', 'RFI')))
    await assertFails(db.doc(RUTA).update(avance('TSSR', 'SSV')))
    await assertFails(db.doc(RUTA).update(avance('TSSR', 'CERRADO')))
  })

  it('rechaza un gate inexistente', async () => {
    await assertFails(
      como(entorno, PERFILES.analista!).doc(RUTA).update({ gateActual: 'INVENTADO' }),
    )
  })

  it('rechaza avanzar sin cerrar el gate de origen', async () => {
    const db = como(entorno, PERFILES.analista!)
    // Sin marcar completado.
    await assertFails(db.doc(RUTA).update({ gateActual: 'FC' }))
    // Completado pero sin fecha real: el cierre no es real.
    await assertFails(db.doc(RUTA).update({ gateActual: 'FC', 'gates.TSSR.estado': 'completado' }))
  })

  it('solo admin y jefe pueden retroceder un gate', async () => {
    await ponerEnGate('FC')
    await assertFails(como(entorno, PERFILES.analista!).doc(RUTA).update({ gateActual: 'TSSR' }))
    await assertSucceeds(como(entorno, PERFILES.jefe!).doc(RUTA).update({ gateActual: 'TSSR' }))

    await ponerEnGate('FC')
    await assertSucceeds(como(entorno, PERFILES.admin!).doc(RUTA).update({ gateActual: 'TSSR' }))
  })

  it('permite cerrar el sitio desde el ultimo gate', async () => {
    await ponerEnGate('SSV')
    await assertSucceeds(
      como(entorno, PERFILES.analista!)
        .doc(RUTA)
        .update({ ...avance('SSV', 'CERRADO'), estadoGate: 'completado' }),
    )
  })

  it('no permite cambiar la identidad del seguimiento', async () => {
    const db = como(entorno, PERFILES.analista!)
    await assertFails(db.doc(RUTA).update({ sitioId: 'OTRO-SITIO' }))
    await assertFails(db.doc(RUTA).update({ proyectoId: 'proy-9' }))
    await assertFails(db.doc(RUTA).update({ programaId: 'prog-9' }))
  })

  it('el lector no puede tocar el seguimiento', async () => {
    const db = como(entorno, PERFILES.lector!)
    await assertSucceeds(db.doc(RUTA).get())
    await assertFails(db.doc(RUTA).update({ prioridad: 'alta' }))
  })

  it('solo el admin borra un seguimiento', async () => {
    await assertFails(como(entorno, PERFILES.jefe!).doc(RUTA).delete())
    await assertSucceeds(como(entorno, PERFILES.admin!).doc(RUTA).delete())
  })
})

describe('visibilidad del contratista', () => {
  it('ve los seguimientos de su empresa', async () => {
    await assertSucceeds(como(entorno, PERFILES.contratista!).doc(RUTA).get())
  })

  it('no ve los de otra empresa', async () => {
    await assertFails(como(entorno, PERFILES.contratista!).doc(RUTA_BETA).get())
    await assertFails(como(entorno, PERFILES.contratistaBeta!).doc(RUTA).get())
  })

  it('su consulta DEBE traer el filtro por proveedor', async () => {
    const db = como(entorno, PERFILES.contratista!)
    // Sin el where la consulta toca documentos ajenos y falla completa.
    await assertFails(db.collection('sitioProyectos').get())
    await assertSucceeds(
      db.collection('sitioProyectos').where('proveedorId', '==', 'prov-alfa').get(),
    )
  })

  it('no puede consultar haciendose pasar por otro proveedor', async () => {
    await assertFails(
      como(entorno, PERFILES.contratista!)
        .collection('sitioProyectos')
        .where('proveedorId', '==', 'prov-beta')
        .get(),
    )
  })
})

describe('que puede escribir el contratista', () => {
  it('puede marcar el checklist de su gate en curso', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.contratista!).doc(RUTA).update({
        'gates.TSSR.checklist.tssr-coordenadas.ok': true,
        'gates.TSSR.checklist.tssr-coordenadas.por': PERFILES.contratista!.uid,
        actualizadoEn: new Date(),
        actualizadoPor: PERFILES.contratista!.uid,
      }),
    )
  })

  it('puede registrar la fecha real de su gate en curso', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.contratista!)
        .doc(RUTA)
        .update({ 'gates.TSSR.fechaReal': '2026-03-04' }),
    )
  })

  it('no puede avanzar el gate: eso lo aprueba la PMO', async () => {
    await assertFails(como(entorno, PERFILES.contratista!).doc(RUTA).update(avance('TSSR', 'FC')))
  })

  it('no puede declarar completado el gate en curso', async () => {
    await assertFails(
      como(entorno, PERFILES.contratista!).doc(RUTA).update({ 'gates.TSSR.estado': 'completado' }),
    )
  })

  it('no puede mover la fecha plan comprometida', async () => {
    await assertFails(
      como(entorno, PERFILES.contratista!)
        .doc(RUTA)
        .update({ 'gates.TSSR.fechaPlan': '2026-12-31' }),
    )
  })

  it('no puede cambiar prioridad, responsable ni bloqueo', async () => {
    const db = como(entorno, PERFILES.contratista!)
    await assertFails(db.doc(RUTA).update({ prioridad: 'baja' }))
    await assertFails(db.doc(RUTA).update({ responsableUid: PERFILES.contratista!.uid }))
    await assertFails(db.doc(RUTA).update({ bloqueado: true, motivoBloqueo: 'x' }))
  })

  it('no puede reasignarse un sitio de otra empresa', async () => {
    await assertFails(
      como(entorno, PERFILES.contratista!).doc(RUTA_BETA).update({ proveedorId: 'prov-alfa' }),
    )
  })

  it('no puede sacar su propio sitio de su cartera', async () => {
    await assertFails(
      como(entorno, PERFILES.contratista!).doc(RUTA).update({ proveedorId: 'prov-beta' }),
    )
  })

  it('no puede crear ni borrar seguimientos', async () => {
    const db = como(entorno, PERFILES.contratista!)
    await assertFails(db.doc('sitioProyectos/proy-1__SITIO-9').set(seguimientoDePrueba()))
    await assertFails(db.doc(RUTA).delete())
  })
})

describe('comentarios de la ficha', () => {
  const comentario = (uid: string) => ({
    texto: 'Se coordino visita con el propietario.',
    uid,
    nombre: 'Persona',
    gateCodigo: 'TSSR',
    ts: marcaServidor(),
  })

  it('el analista comenta', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.analista!)
        .collection(`${RUTA}/comentarios`)
        .add(comentario(PERFILES.analista!.uid)),
    )
  })

  it('el lector no comenta', async () => {
    await assertFails(
      como(entorno, PERFILES.lector!)
        .collection(`${RUTA}/comentarios`)
        .add(comentario(PERFILES.lector!.uid)),
    )
  })

  it('nadie puede comentar en nombre de otro', async () => {
    await assertFails(
      como(entorno, PERFILES.analista!)
        .collection(`${RUTA}/comentarios`)
        .add(comentario('u-admin')),
    )
  })

  it('un comentario no se edita ni se borra', async () => {
    let id = ''
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const ref = await ctx
        .firestore()
        .collection(`${RUTA}/comentarios`)
        .add(comentario(PERFILES.analista!.uid))
      id = ref.id
    })

    const admin = como(entorno, PERFILES.admin!)
    await assertFails(admin.doc(`${RUTA}/comentarios/${id}`).update({ texto: 'editado' }))
    await assertFails(admin.doc(`${RUTA}/comentarios/${id}`).delete())
  })

  it('el contratista de otra empresa no lee los comentarios', async () => {
    await assertFails(
      como(entorno, PERFILES.contratistaBeta!).collection(`${RUTA}/comentarios`).get(),
    )
  })
})

/**
 * La secuencia no esta cableada en las reglas: sale del enlace `siguiente` que
 * cada gate lleva en el propio documento. Estas pruebas usan un proceso que no
 * existe en la plantilla estandar —el de los trackers reales de la PMO— para
 * comprobar que las reglas valen para cualquier plantilla y no solo para la que
 * venia codificada.
 */
describe('secuencia con una plantilla propia', () => {
  const ETAPAS = ['TSS', 'INGENIERIA', 'AS_BUILT', 'ON_AIR']

  function gatesPropios(gateActual: string): Record<string, unknown> {
    const gates: Record<string, unknown> = {}
    ETAPAS.forEach((codigo, i) => {
      gates[codigo] = {
        orden: i * 10, // A proposito no correlativo: los ordenes los pone la plantilla.
        nombre: codigo,
        color: 'azul',
        siguiente: ETAPAS[i + 1] ?? null,
        estado: codigo === gateActual ? 'en_curso' : 'no_iniciado',
        fechaPlan: '2026-03-01',
        fechaReal: null,
        fechaBaseline: null,
        responsableUid: 'u-analista',
        proveedorId: 'prov-alfa',
        checklist: {},
        revisiones: {},
        completadoEn: null,
        completadoPor: null,
      }
    })
    // Requisito paralelo, como FC en los trackers reales: tambien lleva
    // `siguiente: null`, igual que la ultima etapa, pero nunca es etapa actual.
    gates.FC = {
      ...(gates.TSS as Record<string, unknown>),
      orden: 5,
      nombre: 'FC',
      tipo: 'paralela',
      siguiente: null,
      estado: 'no_iniciado',
    }
    return gates
  }

  async function ponerEn(gateActual: string): Promise<void> {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(RUTA)
        .set(seguimientoDePrueba({ gateActual, gates: gatesPropios(gateActual) }))
    })
  }

  it('avanza a la etapa siguiente de SU proceso', async () => {
    await ponerEn('TSS')
    await assertSucceeds(
      como(entorno, PERFILES.analista!).doc(RUTA).update(avance('TSS', 'INGENIERIA')),
    )
  })

  it('no deja saltarse una etapa aunque el orden no sea correlativo', async () => {
    // Es el caso que el enlace `siguiente` existe para cubrir: con ordenes 0, 10,
    // 20 y 30, una regla de "hacia adelante" dejaria pasar este salto.
    await ponerEn('TSS')
    await assertFails(como(entorno, PERFILES.analista!).doc(RUTA).update(avance('TSS', 'AS_BUILT')))
    await assertFails(como(entorno, PERFILES.analista!).doc(RUTA).update(avance('TSS', 'ON_AIR')))
  })

  it('no deja avanzar a una etapa que la plantilla no tiene', async () => {
    await ponerEn('TSS')
    await assertFails(como(entorno, PERFILES.analista!).doc(RUTA).update(avance('TSS', 'RFI')))
  })

  it('desde la ultima etapa se cierra', async () => {
    await ponerEn('ON_AIR')
    await assertSucceeds(
      como(entorno, PERFILES.analista!).doc(RUTA).update(avance('ON_AIR', 'CERRADO')),
    )
  })

  it('pero no se cierra desde una etapa que no es la ultima', async () => {
    await ponerEn('AS_BUILT')
    await assertFails(
      como(entorno, PERFILES.analista!).doc(RUTA).update(avance('AS_BUILT', 'CERRADO')),
    )
  })

  it('retroceder sigue siendo de admin y jefe, tambien aca', async () => {
    await ponerEn('AS_BUILT')
    await assertFails(
      como(entorno, PERFILES.analista!).doc(RUTA).update({ gateActual: 'INGENIERIA' }),
    )
    await assertSucceeds(
      como(entorno, PERFILES.jefe!).doc(RUTA).update({ gateActual: 'INGENIERIA' }),
    )
  })

  it('y retroceder tampoco puede saltarse etapas', async () => {
    await ponerEn('ON_AIR')
    await assertFails(como(entorno, PERFILES.jefe!).doc(RUTA).update({ gateActual: 'TSS' }))
  })

  it('desde CERRADO se vuelve a la ultima etapa, no a cualquiera', async () => {
    await ponerEn('CERRADO')
    await assertSucceeds(como(entorno, PERFILES.jefe!).doc(RUTA).update({ gateActual: 'ON_AIR' }))
    await ponerEn('CERRADO')
    await assertFails(como(entorno, PERFILES.jefe!).doc(RUTA).update({ gateActual: 'TSS' }))
  })

  it('una etapa paralela nunca es destino, ni para el jefe ni para el admin', async () => {
    await ponerEn('CERRADO')
    await assertFails(como(entorno, PERFILES.jefe!).doc(RUTA).update({ gateActual: 'FC' }))
    await assertFails(como(entorno, PERFILES.admin!).doc(RUTA).update({ gateActual: 'FC' }))
    await ponerEn('TSS')
    await assertFails(como(entorno, PERFILES.admin!).doc(RUTA).update({ gateActual: 'FC' }))
  })
})

/**
 * El admin puede corregir el dato a mano desde la app: llevar el sitio a
 * cualquier etapa de su secuencia y eliminar el seguimiento completo. Nadie mas.
 */
describe('correccion administrativa', () => {
  /** Salto de TSSR a D1 cerrando todo lo de en medio, como lo arma planCorreccionAdmin. */
  const salto = {
    gateActual: 'D1',
    estadoGate: 'en_curso',
    'gates.TSSR.estado': 'completado',
    'gates.TSSR.fechaReal': '2026-03-05',
    'gates.FC.estado': 'completado',
    'gates.FC.fechaReal': '2026-03-05',
    'gates.RFI.estado': 'completado',
    'gates.RFI.fechaReal': '2026-03-05',
    'gates.IMP.estado': 'completado',
    'gates.IMP.fechaReal': '2026-03-05',
    'gates.D1.estado': 'en_curso',
  }

  it('el admin salta etapas hacia adelante', async () => {
    await assertSucceeds(como(entorno, PERFILES.admin!).doc(RUTA).update(salto))
  })

  it('el admin cierra el sitio de un salto y lo devuelve a la primera etapa', async () => {
    const db = como(entorno, PERFILES.admin!)
    await assertSucceeds(db.doc(RUTA).update({ gateActual: 'CERRADO', estadoGate: 'completado' }))
    await assertSucceeds(db.doc(RUTA).update({ gateActual: 'TSSR', estadoGate: 'en_curso' }))
  })

  it('el admin retrocede saltando etapas', async () => {
    await ponerEnGate('D7')
    await assertSucceeds(como(entorno, PERFILES.admin!).doc(RUTA).update({ gateActual: 'FC' }))
  })

  it('ni el admin puede mandar el sitio a una etapa que el documento no tiene', async () => {
    await assertFails(como(entorno, PERFILES.admin!).doc(RUTA).update({ gateActual: 'INVENTADO' }))
  })

  it('ni el admin cambia la identidad del seguimiento', async () => {
    const db = como(entorno, PERFILES.admin!)
    await assertFails(db.doc(RUTA).update({ ...salto, sitioId: 'OTRO' }))
    await assertFails(db.doc(RUTA).update({ proyectoId: 'proy-9' }))
    await assertFails(db.doc(RUTA).update({ portafolioId: 'port-9' }))
  })

  it('jefe y analista siguen sin poder saltar', async () => {
    await assertFails(como(entorno, PERFILES.jefe!).doc(RUTA).update(salto))
    await assertFails(como(entorno, PERFILES.analista!).doc(RUTA).update(salto))
    await ponerEnGate('D7')
    await assertFails(como(entorno, PERFILES.jefe!).doc(RUTA).update({ gateActual: 'FC' }))
  })

  it('el contratista sigue sin mover el gate', async () => {
    await assertFails(como(entorno, PERFILES.contratista!).doc(RUTA).update(salto))
  })

  it('el admin puede cambiar la celula', async () => {
    await assertSucceeds(como(entorno, PERFILES.admin!).doc(RUTA).update({ celulaId: 'cel-2' }))
  })

  it('solo el admin elimina un seguimiento', async () => {
    for (const perfil of [PERFILES.jefe!, PERFILES.analista!, PERFILES.lector!]) {
      await assertFails(como(entorno, perfil).doc(RUTA).delete())
    }
    await assertSucceeds(como(entorno, PERFILES.admin!).doc(RUTA).delete())
  })

  describe('comentarios al eliminar', () => {
    let idComentario = ''

    beforeEach(async () => {
      await entorno.withSecurityRulesDisabled(async (ctx) => {
        const ref = await ctx.firestore().collection(`${RUTA}/comentarios`).add({
          texto: 'x',
          uid: PERFILES.analista!.uid,
          nombre: 'Persona',
          gateCodigo: 'TSSR',
          ts: new Date(),
        })
        idComentario = ref.id
      })
    })

    it('el admin borra el seguimiento y sus comentarios en el mismo lote', async () => {
      const db = como(entorno, PERFILES.admin!)
      const lote = db.batch()
      lote.delete(db.doc(RUTA))
      lote.delete(db.doc(`${RUTA}/comentarios/${idComentario}`))
      await assertSucceeds(lote.commit())
    })

    it('y los que quedaron, una vez borrado el padre', async () => {
      const db = como(entorno, PERFILES.admin!)
      await assertSucceeds(db.doc(RUTA).delete())
      await assertSucceeds(db.doc(`${RUTA}/comentarios/${idComentario}`).delete())
    })

    it('pero un comentario de un sitio vivo no se borra', async () => {
      await assertFails(
        como(entorno, PERFILES.admin!).doc(`${RUTA}/comentarios/${idComentario}`).delete(),
      )
    })

    it('y un no admin no los borra ni con el padre eliminado', async () => {
      await entorno.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(RUTA).delete()
      })
      await assertFails(
        como(entorno, PERFILES.jefe!).doc(`${RUTA}/comentarios/${idComentario}`).delete(),
      )
    })
  })
})
