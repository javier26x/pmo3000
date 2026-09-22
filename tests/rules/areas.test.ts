import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { PERFILES, como, crearEntorno, sembrarBase } from './ayudas'

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

const AREA = {
  nombre: 'RF',
  alias: ['RF'],
  responsables: ['u-analista'],
  porProyecto: {},
  activa: true,
}

describe('areas que revisan', () => {
  it('las ve cualquier usuario interno, no el contratista', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('areas/rf').set(AREA)
    })
    for (const perfil of [PERFILES.admin!, PERFILES.jefe!, PERFILES.analista!, PERFILES.lector!]) {
      await assertSucceeds(como(entorno, perfil).collection('areas').get())
    }
    await assertFails(como(entorno, PERFILES.contratista!).collection('areas').get())
  })

  it('las mantienen admin y jefe; analista y lector no', async () => {
    await assertSucceeds(como(entorno, PERFILES.admin!).doc('areas/rf').set(AREA))
    await assertSucceeds(
      como(entorno, PERFILES.jefe!)
        .doc('areas/ece')
        .set({ ...AREA, nombre: 'ECE' }),
    )
    await assertFails(como(entorno, PERFILES.analista!).doc('areas/oocc').set(AREA))
    await assertFails(como(entorno, PERFILES.lector!).doc('areas/oocc').set(AREA))
  })
})
