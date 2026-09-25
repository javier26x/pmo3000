import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { PERFILES, como, crearEntorno, marcaServidor, sembrarBase } from './ayudas'

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
})

const ID = 'proy-1__SITIO-1'

function expediente(uid: string, extra: Record<string, unknown> = {}) {
  return {
    sitioId: 'SITIO-1',
    proyectoId: 'proy-1',
    programaId: 'prog-1',
    celulaId: 'cel-1',
    items: {
      'subtel-de-definitivo': {
        estado: 'listo',
        fecha: '2026-09-01',
        referencia: 'D.E. 123',
        obs: '',
        url: '',
        por: uid,
        en: marcaServidor(),
      },
    },
    actualizadoEn: marcaServidor(),
    actualizadoPor: uid,
    ...extra,
  }
}

describe('expediente regulatorio', () => {
  it('lo marcan analista y jefe; lector y contratista no', async () => {
    for (const perfil of [PERFILES.analista!, PERFILES.jefe!]) {
      await assertSucceeds(
        como(entorno, perfil).doc(`regulatorio/${ID}`).set(expediente(perfil.uid), { merge: true }),
      )
    }
    for (const perfil of [PERFILES.lector!, PERFILES.contratista!]) {
      await assertFails(como(entorno, perfil).doc(`regulatorio/${ID}`).set(expediente(perfil.uid)))
    }
  })

  it('lo leen los internos, no el contratista', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.analista!).doc(`regulatorio/${ID}`).set(expediente('u-analista')),
    )
    for (const perfil of [PERFILES.admin!, PERFILES.jefe!, PERFILES.lector!]) {
      await assertSucceeds(como(entorno, perfil).collection('regulatorio').get())
    }
    await assertFails(como(entorno, PERFILES.contratista!).doc(`regulatorio/${ID}`).get())
  })

  it('no se cuelga de un proyecto distinto al del seguimiento', async () => {
    const db = como(entorno, PERFILES.analista!)
    await assertFails(
      db.doc(`regulatorio/${ID}`).set(expediente('u-analista', { proyectoId: 'proy-2' })),
    )
    await assertFails(
      db.doc(`regulatorio/${ID}`).set(expediente('u-analista', { celulaId: 'cel-otra' })),
    )
  })

  it('exige seguimiento existente, autor propio y forma conocida', async () => {
    const db = como(entorno, PERFILES.analista!)
    await assertFails(db.doc('regulatorio/proy-9__NADA').set(expediente('u-analista')))
    await assertFails(db.doc(`regulatorio/${ID}`).set(expediente('u-jefe')))
    await assertFails(
      db.doc(`regulatorio/${ID}`).set(expediente('u-analista', { modalidad: 'otra' })),
    )
    await assertFails(
      db.doc(`regulatorio/${ID}`).set(expediente('u-analista', { gateActual: 'CERRADO' })),
    )
  })

  it('solo el admin lo borra', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.analista!).doc(`regulatorio/${ID}`).set(expediente('u-analista')),
    )
    await assertFails(como(entorno, PERFILES.jefe!).doc(`regulatorio/${ID}`).delete())
    await assertSucceeds(como(entorno, PERFILES.admin!).doc(`regulatorio/${ID}`).delete())
  })
})
