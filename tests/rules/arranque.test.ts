/**
 * El arranque de una instalación nueva: nadie tiene perfil todavía y alguien
 * tiene que poder administrarla. La lista correosAdministradores() de las reglas
 * es la que decide, y estos tests fijan hasta dónde llega ese permiso.
 */
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
  type TokenOptions,
} from '@firebase/rules-unit-testing'
import { crearEntorno, marcaServidor } from './ayudas'

let entorno: RulesTestEnvironment

beforeAll(async () => {
  entorno = await crearEntorno()
})
afterEach(async () => {
  await entorno.clearFirestore()
})
afterAll(async () => {
  await entorno.cleanup()
})

/** El correo de la lista, tal como lo emite Google al entrar con la cuenta. */
const ADMIN_EXTERNO = 'javier.neo@gmail.com'

function token(email: string, verificado = true): TokenOptions {
  return { email, email_verified: verificado }
}

/** Exactamente el documento que escribe asegurarPerfil(). */
function alta(uid: string, email: string, rol: string) {
  return {
    email: email.toLowerCase(),
    nombre: 'Persona',
    rol,
    celulaId: null,
    proveedorId: null,
    activo: true,
    ultimoAcceso: marcaServidor(),
    creadoEn: marcaServidor(),
    creadoPor: uid,
    actualizadoEn: marcaServidor(),
    actualizadoPor: uid,
  }
}

async function sembrarPerfil(uid: string, email: string, rol: string) {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(`usuarios/${uid}`)
      .set(alta(uid, email, rol))
  })
}

describe('alta del primer perfil', () => {
  it('el correo de la lista se crea como admin', async () => {
    const db = entorno.authenticatedContext('u-ext', token(ADMIN_EXTERNO)).firestore()
    await assertSucceeds(db.doc('usuarios/u-ext').set(alta('u-ext', ADMIN_EXTERNO, 'admin')))
  })

  it('un correo corporativo se crea como lector, no como admin', async () => {
    const db = entorno.authenticatedContext('u-corp', token('ana@clarovtr.cl')).firestore()
    await assertSucceeds(db.doc('usuarios/u-corp').set(alta('u-corp', 'ana@clarovtr.cl', 'lector')))
  })

  it('un correo corporativo no se puede crear como admin', async () => {
    const db = entorno.authenticatedContext('u-corp', token('ana@clarovtr.cl')).firestore()
    await assertFails(db.doc('usuarios/u-corp').set(alta('u-corp', 'ana@clarovtr.cl', 'admin')))
  })

  it('un correo externo fuera de la lista no entra ni como lector', async () => {
    const db = entorno.authenticatedContext('u-otro', token('otro@gmail.com')).firestore()
    await assertFails(db.doc('usuarios/u-otro').set(alta('u-otro', 'otro@gmail.com', 'lector')))
  })

  it('sin el correo verificado no entra, aunque esté en la lista', async () => {
    const db = entorno.authenticatedContext('u-ext', token(ADMIN_EXTERNO, false)).firestore()
    await assertFails(db.doc('usuarios/u-ext').set(alta('u-ext', ADMIN_EXTERNO, 'admin')))
  })
})

describe('corrección del rol del administrador externo', () => {
  it('si su perfil quedó como lector, puede corregirlo a admin', async () => {
    await sembrarPerfil('u-ext', ADMIN_EXTERNO, 'lector')
    const db = entorno.authenticatedContext('u-ext', token(ADMIN_EXTERNO)).firestore()
    await assertSucceeds(
      db.doc('usuarios/u-ext').update({
        rol: 'admin',
        ultimoAcceso: marcaServidor(),
        actualizadoEn: marcaServidor(),
        actualizadoPor: 'u-ext',
      }),
    )
  })

  it('pero no puede aprovechar el paso para tocar otra cosa', async () => {
    await sembrarPerfil('u-ext', ADMIN_EXTERNO, 'lector')
    const db = entorno.authenticatedContext('u-ext', token(ADMIN_EXTERNO)).firestore()
    await assertFails(db.doc('usuarios/u-ext').update({ rol: 'admin', proveedorId: 'prov-1' }))
  })

  it('un corporativo cualquiera no puede ascenderse solo', async () => {
    await sembrarPerfil('u-corp', 'ana@clarovtr.cl', 'lector')
    const db = entorno.authenticatedContext('u-corp', token('ana@clarovtr.cl')).firestore()
    await assertFails(db.doc('usuarios/u-corp').update({ rol: 'admin' }))
  })

  it('y el de la lista tampoco puede ascender a un tercero', async () => {
    await sembrarPerfil('u-ext', ADMIN_EXTERNO, 'lector')
    await sembrarPerfil('u-corp', 'ana@clarovtr.cl', 'lector')
    const db = entorno.authenticatedContext('u-ext', token(ADMIN_EXTERNO)).firestore()
    await assertFails(db.doc('usuarios/u-corp').update({ rol: 'admin' }))
  })
})
