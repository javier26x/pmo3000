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

const solicitud = (uid: string, extra: Record<string, unknown> = {}) => ({
  sitioId: 'SITIO-1',
  programaId: 'prog-1',
  asunto: 'CREAR_CARPETA | Plan 200 | SITIO-1 | Sitio Uno',
  cuerpo: 'Solicitud automática generada por PMO3000.',
  via: 'correo',
  estado: 'preparada',
  generadoPor: uid,
  generadoEn: marcaServidor(),
  carpetaUrl: null,
  ...extra,
})

describe('solicitudes de carpeta', () => {
  it('quien gestiona sitios registra la suya', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.analista!)
        .collection('solicitudesCarpeta')
        .add(solicitud(PERFILES.analista!.uid)),
    )
  })

  it('nadie la registra a nombre de otro', async () => {
    await assertFails(
      como(entorno, PERFILES.analista!).collection('solicitudesCarpeta').add(solicitud('u-admin')),
    )
  })

  it('el lector y el contratista no la registran', async () => {
    await assertFails(
      como(entorno, PERFILES.lector!)
        .collection('solicitudesCarpeta')
        .add(solicitud(PERFILES.lector!.uid)),
    )
    await assertFails(
      como(entorno, PERFILES.contratista!)
        .collection('solicitudesCarpeta')
        .add(solicitud(PERFILES.contratista!.uid)),
    )
  })

  it('es un rastro: no se edita', async () => {
    let id = ''
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      id = (await ctx.firestore().collection('solicitudesCarpeta').add(solicitud('u-analista'))).id
    })
    await assertFails(
      como(entorno, PERFILES.admin!).doc(`solicitudesCarpeta/${id}`).update({ estado: 'creada' }),
    )
  })
})
