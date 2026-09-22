import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { PERFILES, como, comoExterno, crearEntorno, sembrarBase } from './ayudas'

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

// comoExterno() entra como persona@gmail.com, uid u-externo.
const CORREO = 'persona@gmail.com'
const ALCANCE = { celulas: [], programas: [], proyectos: ['proy-1'] }
const INVITACION = {
  email: CORREO,
  nombre: 'Persona Externa',
  rol: 'contratista',
  celulaId: null,
  proveedorId: 'prov-alfa',
  alcance: ALCANCE,
  estado: 'pendiente',
  invitadoPor: 'u-admin',
  invitadoEn: new Date(),
  aceptadaEn: null,
}

const perfil = (extra: Record<string, unknown> = {}) => ({
  email: CORREO,
  nombre: 'Persona Externa',
  rol: 'contratista',
  celulaId: null,
  proveedorId: 'prov-alfa',
  alcance: ALCANCE,
  activo: true,
  ...extra,
})

async function invitar(extra: Record<string, unknown> = {}) {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(`invitaciones/${CORREO}`)
      .set({ ...INVITACION, ...extra })
  })
}

describe('invitaciones', () => {
  it('solo el admin invita', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.admin!).doc(`invitaciones/${CORREO}`).set(INVITACION),
    )
    await assertFails(
      como(entorno, PERFILES.jefe!)
        .doc('invitaciones/otra@gmail.com')
        .set({
          ...INVITACION,
          email: 'otra@gmail.com',
        }),
    )
  })

  it('un contratista invitado sin proveedor se rechaza', async () => {
    await assertFails(
      como(entorno, PERFILES.admin!)
        .doc(`invitaciones/${CORREO}`)
        .set({ ...INVITACION, proveedorId: null }),
    )
  })

  it('un externo sin invitacion no puede crear su perfil', async () => {
    await assertFails(comoExterno(entorno).doc('usuarios/u-externo').set(perfil()))
  })

  it('un externo invitado crea su perfil con lo que dice la invitacion', async () => {
    await invitar()
    const db = comoExterno(entorno)
    await assertSucceeds(db.doc(`invitaciones/${CORREO}`).get())
    await assertSucceeds(db.doc('usuarios/u-externo').set(perfil()))
    await assertSucceeds(
      db
        .doc(`invitaciones/${CORREO}`)
        .update({ estado: 'aceptada', aceptadaEn: new Date(), uid: 'u-externo' }),
    )
  })

  it('pero no con otro rol, otro proveedor ni otro alcance', async () => {
    await invitar()
    const db = comoExterno(entorno)
    await assertFails(db.doc('usuarios/u-externo').set(perfil({ rol: 'admin', proveedorId: null })))
    await assertFails(db.doc('usuarios/u-externo').set(perfil({ proveedorId: 'prov-beta' })))
    await assertFails(
      db
        .doc('usuarios/u-externo')
        .set(perfil({ alcance: { celulas: [], programas: [], proyectos: [] } })),
    )
  })

  it('con la invitacion revocada no entra', async () => {
    await invitar({ estado: 'revocada' })
    await assertFails(comoExterno(entorno).doc('usuarios/u-externo').set(perfil()))
  })

  it('revocar le quita el acceso aunque ya tenga perfil', async () => {
    // Sin alcance, para que baste la consulta por proveedor del contratista.
    const sinAlcance = { alcance: { celulas: [], programas: [], proyectos: [] } }
    await invitar(sinAlcance)
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('usuarios/u-externo').set(perfil(sinAlcance))
    })
    const db = comoExterno(entorno)
    await assertSucceeds(
      db.collection('sitioProyectos').where('proveedorId', '==', 'prov-alfa').get(),
    )
    await invitar({ ...sinAlcance, estado: 'revocada' })
    await assertFails(db.collection('sitioProyectos').where('proveedorId', '==', 'prov-alfa').get())
  })

  it('nadie lee la invitacion de otro', async () => {
    await invitar()
    await assertFails(como(entorno, PERFILES.analista!).doc(`invitaciones/${CORREO}`).get())
  })
})
