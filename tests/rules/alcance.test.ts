/**
 * Perfiles acotados: un usuario con alcance solo lee y escribe los seguimientos
 * cuya celula, programa O proyecto esta en sus listas. Ver firestore.rules >
 * enAlcance() y src/domain/permisos/alcance.ts.
 *
 * Las consultas se arman con la API modular (or/and/in), igual que la app en
 * src/data/repos/sitioProyectos.ts > consultaVisible: lo que se prueba es que
 * las reglas acepten exactamente esa forma de consulta y rechacen las demas.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  and,
  collection,
  doc,
  getDoc,
  getDocs,
  or,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type QueryFieldFilterConstraint,
} from 'firebase/firestore'
import {
  PERFILES,
  como,
  crearEntorno,
  marcaServidor,
  sembrarBase,
  seguimientoDePrueba,
  type PerfilPrueba,
} from './ayudas'
import { planAlcance } from '../../src/domain/permisos/alcance'
import type { Rol } from '../../src/domain/tipos/comunes'

type Alcance = { celulas: string[]; programas: string[]; proyectos: string[] }
const vacio: Alcance = { celulas: [], programas: [], proyectos: [] }

const ACOTADOS = {
  // Solo la celula 2: ve proy-3 y nada de la celula 1.
  jefe: {
    uid: 'u-jefe-acotado',
    email: 'jefeacotado@clarovtr.cl',
    rol: 'jefe_celula',
    celulaId: 'cel-2',
    proveedorId: null,
    alcance: { ...vacio, celulas: ['cel-2'] },
  },
  // Un proyecto de la celula 1 y el programa 2: ve proy-1 y proy-3.
  analista: {
    uid: 'u-analista-acotado',
    email: 'analistaacotado@clarovtr.cl',
    rol: 'analista',
    celulaId: null,
    proveedorId: null,
    alcance: { ...vacio, programas: ['prog-2'], proyectos: ['proy-1'] },
  },
  // Contratista de Alfa, acotado al programa 2: de lo de Alfa, solo proy-3.
  contratista: {
    uid: 'u-contra-acotado',
    email: 'contraacotado@clarovtr.cl',
    rol: 'contratista',
    celulaId: null,
    proveedorId: 'prov-alfa',
    alcance: { ...vacio, programas: ['prog-2'] },
  },
  // Admin con listas: las reglas lo ignoran.
  admin: {
    uid: 'u-admin-acotado',
    email: 'adminacotado@clarovtr.cl',
    rol: 'admin',
    celulaId: null,
    proveedorId: null,
    alcance: { ...vacio, celulas: ['cel-2'] },
  },
  // Alcance presente pero vacio: sin restriccion.
  vacio: {
    uid: 'u-lector-vacio',
    email: 'lectorvacio@clarovtr.cl',
    rol: 'lector',
    celulaId: null,
    proveedorId: null,
    alcance: vacio,
  },
} satisfies Record<string, PerfilPrueba & { alcance: Alcance }>

const DENTRO = 'sitioProyectos/proy-3__SITIO-1'
const FUERA = 'sitioProyectos/proy-1__SITIO-1'

let entorno: RulesTestEnvironment

beforeAll(async () => {
  entorno = await crearEntorno()
})

afterAll(async () => {
  await entorno.cleanup()
})

beforeEach(async () => {
  await entorno.clearFirestore()
  await sembrarBase(entorno)
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const p of Object.values(ACOTADOS)) {
      await db.doc(`usuarios/${p.uid}`).set({
        email: p.email,
        nombre: p.uid,
        rol: p.rol,
        celulaId: p.celulaId,
        proveedorId: p.proveedorId,
        alcance: p.alcance,
        activo: true,
        ultimoAcceso: null,
      })
    }
    // Un tercer seguimiento, de otra celula, otro programa y otro proyecto.
    await db.doc(DENTRO).set(
      seguimientoDePrueba({
        proyectoId: 'proy-3',
        programaId: 'prog-2',
        celulaId: 'cel-2',
        proveedorId: 'prov-alfa',
      }),
    )
    await db.doc(`${FUERA}/comentarios/c-1`).set({ texto: 'hola', uid: 'u-analista' })
    await db.doc(`${DENTRO}/comentarios/c-1`).set({ texto: 'hola', uid: 'u-analista' })
  })
})

/** Modular sobre el contexto de prueba (que es compat). */
const modular = (perfil: PerfilPrueba) => como(entorno, perfil) as unknown as Firestore

/**
 * La misma consulta que arma consultaVisible() en la app: igualdades del
 * usuario mas el or() del alcance ajustado con planAlcance(). Null cuando el
 * plan dice que no hay nada que consultar.
 */
function consultaAcotada(
  db: Firestore,
  perfil: PerfilPrueba & { alcance: Alcance },
  igualdades: Record<string, string> = {},
) {
  const base = collection(db, 'sitioProyectos')
  const filtros = Object.entries(igualdades).map(([campo, valor]) => where(campo, '==', valor))
  const plan = planAlcance({ rol: perfil.rol as Rol, alcance: perfil.alcance }, igualdades)
  if (plan.tipo === 'vacio') return null
  if (plan.tipo === 'sinRestriccion') return query(base, ...filtros)
  const enAlcance = or(...plan.disyunciones.map((d) => where(d.campo, 'in', d.valores)))
  return query(base, and(...filtros, enAlcance))
}

/** El or() completo, sin ajustar a las igualdades: para probar lo que NO pasa. */
function orCompleto(db: Firestore, alcance: Alcance, igualdades: Record<string, string> = {}) {
  const disyunciones = [
    alcance.celulas.length ? where('celulaId', 'in', alcance.celulas) : null,
    alcance.programas.length ? where('programaId', 'in', alcance.programas) : null,
    alcance.proyectos.length ? where('proyectoId', 'in', alcance.proyectos) : null,
  ].filter((d): d is QueryFieldFilterConstraint => d !== null)
  const filtros = Object.entries(igualdades).map(([campo, valor]) => where(campo, '==', valor))
  return query(collection(db, 'sitioProyectos'), and(...filtros, or(...disyunciones)))
}

/** Ejecuta la consulta acotada; exige que exista (el plan no fue 'vacio'). */
function leer(q: ReturnType<typeof consultaAcotada>) {
  if (!q) throw new Error('El plan dijo que no hay nada que consultar')
  return getDocs(q)
}

const ids = (snap: { docs: { id: string }[] }) => snap.docs.map((d) => d.id).sort()

describe('lectura acotada', () => {
  it('el jefe acotado lista con el or() de su alcance y recibe solo lo suyo', async () => {
    const db = modular(ACOTADOS.jefe)
    const snap = await assertSucceeds(leer(consultaAcotada(db, ACOTADOS.jefe)))
    expect(ids(snap)).toEqual(['proy-3__SITIO-1'])
  })

  it('sin el or() la consulta completa falla', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertFails(getDocs(collection(db, 'sitioProyectos')))
    await assertFails(
      getDocs(query(collection(db, 'sitioProyectos'), where('sitioId', '==', 'SITIO-1'))),
    )
  })

  it('un filtro de igualdad solo no alcanza aunque apunte dentro del alcance', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertFails(
      getDocs(query(collection(db, 'sitioProyectos'), where('programaId', '==', 'prog-2'))),
    )
  })

  it('igualdades del usuario mas el or() del alcance si pasan', async () => {
    const db = modular(ACOTADOS.jefe)
    const snap = await assertSucceeds(
      leer(consultaAcotada(db, ACOTADOS.jefe, { programaId: 'prog-2', sitioId: 'SITIO-1' })),
    )
    expect(ids(snap)).toEqual(['proy-3__SITIO-1'])

    // Un filtro que no cruza el alcance devuelve vacio, no un error.
    const nada = await assertSucceeds(
      leer(consultaAcotada(db, ACOTADOS.jefe, { programaId: 'prog-1' })),
    )
    expect(nada.size).toBe(0)
  })

  it('el analista con dos listas ve la union', async () => {
    const db = modular(ACOTADOS.analista)
    const snap = await assertSucceeds(leer(consultaAcotada(db, ACOTADOS.analista)))
    expect(ids(snap)).toEqual(['proy-1__SITIO-1', 'proy-3__SITIO-1'])
  })

  it('el analista filtra dentro de su union', async () => {
    const db = modular(ACOTADOS.analista)
    // prog-1 no esta en su lista de programas, pero proy-1 esta en la de
    // proyectos: el plan quita la disyuncion de programas y deja la otra.
    const filtrado = await assertSucceeds(
      leer(consultaAcotada(db, ACOTADOS.analista, { programaId: 'prog-1' })),
    )
    expect(ids(filtrado)).toEqual(['proy-1__SITIO-1'])

    // Un programa de su lista: la igualdad sola ya prueba el alcance.
    const propio = await assertSucceeds(
      leer(consultaAcotada(db, ACOTADOS.analista, { programaId: 'prog-2' })),
    )
    expect(ids(propio)).toEqual(['proy-3__SITIO-1'])
  })

  it('el or() completo con una igualdad que lo contradice falla (por eso el plan)', async () => {
    // Disyuncion "programaId == prog-1 Y programaId == prog-2": no devuelve
    // nada, pero la regla no puede probarla y rechaza la consulta entera.
    const db = modular(ACOTADOS.analista)
    await assertFails(getDocs(orCompleto(db, ACOTADOS.analista.alcance, { programaId: 'prog-1' })))
  })

  it('si el filtro no cruza el alcance, el plan ni consulta', () => {
    const db = modular(ACOTADOS.analista)
    expect(
      consultaAcotada(db, ACOTADOS.analista, { programaId: 'prog-1', proyectoId: 'proy-2' }),
    ).toBeNull()
  })

  it('un alcance en el tope de 30 entradas sigue siendo consultable', async () => {
    const lleno = {
      ...ACOTADOS.jefe,
      alcance: {
        celulas: ['cel-2', ...Array.from({ length: 14 }, (_, i) => `cel-x${i}`)],
        programas: Array.from({ length: 10 }, (_, i) => `prog-x${i}`),
        proyectos: Array.from({ length: 5 }, (_, i) => `proy-x${i}`),
      },
    }
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`usuarios/${lleno.uid}`).update({ alcance: lleno.alcance })
    })
    const db = modular(lleno)
    const snap = await assertSucceeds(leer(consultaAcotada(db, lleno, { sitioId: 'SITIO-1' })))
    expect(ids(snap)).toEqual(['proy-3__SITIO-1'])
  })

  it('no puede consultar con un or() mas amplio que su alcance', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertFails(getDocs(orCompleto(db, { ...vacio, celulas: ['cel-1', 'cel-2'] })))
  })

  it('lee un seguimiento de su alcance, no uno de fuera', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertSucceeds(getDoc(doc(db, DENTRO)))
    await assertFails(getDoc(doc(db, FUERA)))
  })

  it('leer un id que no existe se permite (el alta lo necesita)', async () => {
    await assertSucceeds(getDoc(doc(modular(ACOTADOS.jefe), 'sitioProyectos/no-existe')))
  })

  it('los comentarios siguen al seguimiento', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertSucceeds(getDocs(collection(db, `${DENTRO}/comentarios`)))
    await assertFails(getDocs(collection(db, `${FUERA}/comentarios`)))
    await assertFails(getDoc(doc(db, `${FUERA}/comentarios/c-1`)))
  })
})

describe('escritura acotada', () => {
  it('edita lo de su alcance, no lo de fuera', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertSucceeds(updateDoc(doc(db, DENTRO), { prioridad: 'alta' }))
    await assertFails(updateDoc(doc(db, FUERA), { prioridad: 'alta' }))
  })

  it('no puede sacar un seguimiento de su alcance', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertFails(updateDoc(doc(db, DENTRO), { celulaId: 'cel-1' }))
  })

  it('solo crea seguimientos dentro de su alcance', async () => {
    const db = modular(ACOTADOS.jefe)
    await assertSucceeds(
      setDoc(
        doc(db, 'sitioProyectos/proy-4__SITIO-1'),
        seguimientoDePrueba({ proyectoId: 'proy-4', programaId: 'prog-4', celulaId: 'cel-2' }),
      ),
    )
    await assertFails(
      setDoc(
        doc(db, 'sitioProyectos/proy-5__SITIO-1'),
        seguimientoDePrueba({ proyectoId: 'proy-5', programaId: 'prog-5', celulaId: 'cel-1' }),
      ),
    )
  })

  it('comenta solo en seguimientos de su alcance', async () => {
    const comentario = {
      texto: 'Visita coordinada',
      uid: ACOTADOS.jefe.uid,
      nombre: 'Jefe',
      gateCodigo: null,
      ts: marcaServidor(),
    }
    const compat = como(entorno, ACOTADOS.jefe)
    await assertSucceeds(compat.collection(`${DENTRO}/comentarios`).add(comentario))
    await assertFails(compat.collection(`${FUERA}/comentarios`).add(comentario))
  })
})

describe('contratista con alcance', () => {
  it('necesita el filtro de proveedor Y el or() del alcance', async () => {
    const db = modular(ACOTADOS.contratista)
    const snap = await assertSucceeds(
      leer(consultaAcotada(db, ACOTADOS.contratista, { proveedorId: 'prov-alfa' })),
    )
    expect(ids(snap)).toEqual(['proy-3__SITIO-1'])

    await assertFails(
      getDocs(query(collection(db, 'sitioProyectos'), where('proveedorId', '==', 'prov-alfa'))),
    )
    await assertFails(getDocs(orCompleto(db, ACOTADOS.contratista.alcance)))
  })

  it('no lee un seguimiento de su empresa que esta fuera del alcance', async () => {
    const db = modular(ACOTADOS.contratista)
    await assertFails(getDoc(doc(db, FUERA)))
    await assertSucceeds(getDoc(doc(db, DENTRO)))
  })

  it('no reporta avance fuera de su alcance', async () => {
    const db = modular(ACOTADOS.contratista)
    await assertFails(
      updateDoc(doc(db, FUERA), { 'gates.TSSR.checklist.x': { ok: true }, actualizadoPor: 'x' }),
    )
  })
})

describe('sin restriccion', () => {
  it('el admin no queda acotado aunque su perfil traiga listas', async () => {
    const db = modular(ACOTADOS.admin)
    const snap = await assertSucceeds(getDocs(collection(db, 'sitioProyectos')))
    expect(snap.size).toBe(3)
    await assertSucceeds(updateDoc(doc(db, FUERA), { prioridad: 'alta' }))
  })

  it('un alcance vacio es igual a no tenerlo', async () => {
    const db = modular(ACOTADOS.vacio)
    const snap = await assertSucceeds(getDocs(collection(db, 'sitioProyectos')))
    expect(snap.size).toBe(3)
    await assertSucceeds(getDocs(collection(db, `${FUERA}/comentarios`)))
  })

  it('un perfil sin el campo alcance sigue sin restriccion', async () => {
    const db = modular(PERFILES.analista!)
    await assertSucceeds(getDocs(collection(db, 'sitioProyectos')))
    await assertSucceeds(updateDoc(doc(db, FUERA), { prioridad: 'alta' }))
  })
})

describe('quien asigna el alcance', () => {
  it('nadie se asigna ni se quita su propio alcance', async () => {
    await assertFails(
      updateDoc(doc(modular(PERFILES.analista!), `usuarios/${PERFILES.analista!.uid}`), {
        alcance: { ...vacio, celulas: ['cel-1'] },
      }),
    )
    await assertFails(
      updateDoc(doc(modular(ACOTADOS.jefe), `usuarios/${ACOTADOS.jefe.uid}`), { alcance: vacio }),
    )
  })

  it('un jefe no asigna alcances a otros', async () => {
    await assertFails(
      updateDoc(doc(modular(PERFILES.jefe!), `usuarios/${ACOTADOS.analista.uid}`), {
        alcance: vacio,
      }),
    )
  })

  it('el alta de un perfil no puede traer alcance', async () => {
    const db = entorno
      .authenticatedContext('u-nuevo', { email: 'nuevo@clarovtr.cl', email_verified: true })
      .firestore() as unknown as Firestore
    const perfil = {
      email: 'nuevo@clarovtr.cl',
      nombre: 'Nuevo',
      rol: 'lector',
      celulaId: null,
      proveedorId: null,
      activo: true,
      ultimoAcceso: null,
    }
    await assertFails(
      setDoc(doc(db, 'usuarios/u-nuevo'), { ...perfil, alcance: { ...vacio, celulas: ['x'] } }),
    )
    await assertSucceeds(setDoc(doc(db, 'usuarios/u-nuevo'), { ...perfil, alcance: vacio }))
  })

  it('el admin asigna el alcance', async () => {
    const db = modular(PERFILES.admin!)
    await assertSucceeds(
      updateDoc(doc(db, `usuarios/${PERFILES.analista!.uid}`), {
        alcance: { ...vacio, programas: ['prog-1'] },
      }),
    )
  })

  it('el admin no puede pasar del tope de 30 entradas ni guardar una forma rara', async () => {
    const db = modular(PERFILES.admin!)
    const treintaYUno = Array.from({ length: 31 }, (_, i) => `cel-${i}`)
    await assertFails(
      updateDoc(doc(db, `usuarios/${PERFILES.analista!.uid}`), {
        alcance: { ...vacio, celulas: treintaYUno },
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, `usuarios/${PERFILES.analista!.uid}`), {
        alcance: {
          celulas: treintaYUno.slice(0, 20),
          programas: treintaYUno.slice(20, 30),
          proyectos: [],
        },
      }),
    )
    await assertFails(
      updateDoc(doc(db, `usuarios/${PERFILES.analista!.uid}`), { alcance: 'cel-1' }),
    )
    await assertFails(
      updateDoc(doc(db, `usuarios/${PERFILES.analista!.uid}`), {
        alcance: { ...vacio, sitios: ['SITIO-1'] },
      }),
    )
  })
})
