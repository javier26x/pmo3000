import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { crearEntorno, sembrarBase } from './ayudas'

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

/** Token como el de Microsoft 365: correo sin verificar segun Firebase. */
function comoMicrosoft(email: string, uid = 'u-ms') {
  return entorno
    .authenticatedContext(uid, {
      email,
      email_verified: false,
      firebase: { sign_in_provider: 'microsoft.com' },
    })
    .firestore()
}

const perfilLector = (email: string) => ({
  email,
  nombre: 'Persona Claro',
  rol: 'lector',
  celulaId: null,
  proveedorId: null,
  alcance: { celulas: [], programas: [], proyectos: [] },
  activo: true,
})

describe('ingreso con Microsoft 365', () => {
  it('una cuenta corporativa entra como lector aunque Firebase no marque el correo verificado', async () => {
    await assertSucceeds(
      comoMicrosoft('persona@clarovtr.cl')
        .doc('usuarios/u-ms')
        .set(perfilLector('persona@clarovtr.cl')),
    )
  })

  it('una cuenta de Microsoft de otro dominio no entra', async () => {
    await assertFails(
      comoMicrosoft('persona@outlook.com')
        .doc('usuarios/u-ms')
        .set(perfilLector('persona@outlook.com')),
    )
  })

  it('con otro proveedor, el correo sin verificar sigue sin entrar', async () => {
    const db = entorno
      .authenticatedContext('u-x', {
        email: 'persona@clarovtr.cl',
        email_verified: false,
        firebase: { sign_in_provider: 'password' },
      })
      .firestore()
    await assertFails(db.doc('usuarios/u-x').set(perfilLector('persona@clarovtr.cl')))
  })
})
