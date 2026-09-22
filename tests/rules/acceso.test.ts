import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { PERFILES, como, comoExterno, comoNoVerificado, crearEntorno, sembrarBase } from './ayudas'

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

describe('puerta de entrada', () => {
  it('rechaza a quien no esta autenticado', async () => {
    const db = entorno.unauthenticatedContext().firestore()
    await assertFails(db.doc('sitios/SITIO-1').get())
  })

  it('rechaza correos que no son del dominio corporativo', async () => {
    const db = comoExterno(entorno)
    await assertFails(db.doc('sitios/SITIO-1').get())
    await assertFails(db.collection('sitios').get())
  })

  it('rechaza correos corporativos sin verificar', async () => {
    await assertFails(comoNoVerificado(entorno).doc('sitios/SITIO-1').get())
  })

  it('rechaza a un usuario corporativo sin perfil creado', async () => {
    const db = entorno
      .authenticatedContext('u-sin-perfil', { email: 'nuevo@clarovtr.cl', email_verified: true })
      .firestore()
    await assertFails(db.doc('sitios/SITIO-1').get())
  })

  it('rechaza a un usuario desactivado', async () => {
    await assertFails(como(entorno, PERFILES.inactivo!).doc('sitios/SITIO-1').get())
  })

  it('deja entrar a un usuario corporativo activo', async () => {
    await assertSucceeds(como(entorno, PERFILES.analista!).doc('sitios/SITIO-1').get())
  })

  it('no permite que un dominio parecido pase el filtro', async () => {
    const db = entorno
      .authenticatedContext('u-falso', { email: 'persona@noclarovtr.cl', email_verified: true })
      .firestore()
    await assertFails(db.doc('sitios/SITIO-1').get())
  })
})

describe('maestro de sitios', () => {
  const sitioNuevo = {
    nombre: 'Sitio nuevo',
    region: 'Maule',
    comuna: 'Curico',
    direccion: '',
    lat: -34.9,
    lon: -71.2,
    tecnologias: ['4G'],
    tipoSitio: 'Rooftop',
    carpetaUrl: null,
    activo: true,
  }

  it('el analista puede crear y editar sitios', async () => {
    const db = como(entorno, PERFILES.analista!)
    await assertSucceeds(db.doc('sitios/SITIO-NUEVO').set(sitioNuevo))
    await assertSucceeds(db.doc('sitios/SITIO-1').update({ comuna: 'Linares' }))
  })

  it('el lector no puede escribir', async () => {
    const db = como(entorno, PERFILES.lector!)
    await assertSucceeds(db.doc('sitios/SITIO-1').get())
    await assertFails(db.doc('sitios/SITIO-NUEVO').set(sitioNuevo))
    await assertFails(db.doc('sitios/SITIO-1').update({ comuna: 'Linares' }))
  })

  it('el contratista lee el maestro pero no lo modifica', async () => {
    const db = como(entorno, PERFILES.contratista!)
    await assertSucceeds(db.doc('sitios/SITIO-1').get())
    await assertFails(db.doc('sitios/SITIO-1').update({ comuna: 'Linares' }))
  })

  it('solo el admin borra sitios', async () => {
    await assertFails(como(entorno, PERFILES.analista!).doc('sitios/SITIO-1').delete())
    await assertSucceeds(como(entorno, PERFILES.admin!).doc('sitios/SITIO-1').delete())
  })
})

describe('catalogos', () => {
  it('solo el admin edita programas y plantillas de gates', async () => {
    const analista = como(entorno, PERFILES.analista!)
    await assertSucceeds(analista.doc('programas/prog-1').get())
    await assertFails(analista.doc('programas/prog-1').update({ nombre: 'Otro' }))
    await assertFails(analista.doc('gateTemplates/estandar-despliegue').update({ version: 2 }))

    const admin = como(entorno, PERFILES.admin!)
    await assertSucceeds(admin.doc('programas/prog-1').update({ nombre: 'Otro' }))
    await assertSucceeds(admin.doc('gateTemplates/estandar-despliegue').update({ version: 2 }))
  })

  it('el jefe de celula puede editar proyectos', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.jefe!).doc('proyectos/proy-1').update({ nombre: 'Proyecto B' }),
    )
  })

  it('el contratista no ve el portafolio ni los programas', async () => {
    const db = como(entorno, PERFILES.contratista!)
    await assertFails(db.doc('programas/prog-1').get())
    await assertFails(db.doc('portafolios/port-1').get())
    // Si necesita la plantilla para ver su checklist, esa si la lee.
    await assertSucceeds(db.doc('gateTemplates/estandar-despliegue').get())
  })
})

describe('tareas', () => {
  it('el analista crea y edita tareas; el lector no', async () => {
    const analista = como(entorno, PERFILES.analista!)
    await assertSucceeds(
      analista.doc('tareas/t-2').set({ titulo: 'Nueva', estado: 'backlog', orden: 2000 }),
    )
    await assertSucceeds(analista.doc('tareas/t-1').update({ estado: 'en_curso' }))

    const lector = como(entorno, PERFILES.lector!)
    await assertSucceeds(lector.doc('tareas/t-1').get())
    await assertFails(lector.doc('tareas/t-1').update({ estado: 'hecha' }))
  })

  it('el contratista lee tareas pero no las cambia', async () => {
    const db = como(entorno, PERFILES.contratista!)
    await assertSucceeds(db.doc('tareas/t-1').get())
    await assertFails(db.doc('tareas/t-1').update({ estado: 'hecha' }))
  })

  it('borrar tareas es de admin y jefe', async () => {
    await assertFails(como(entorno, PERFILES.analista!).doc('tareas/t-1').delete())
    await assertSucceeds(como(entorno, PERFILES.jefe!).doc('tareas/t-1').delete())
  })
})

describe('coleccion no declarada', () => {
  it('queda cerrada incluso para el admin', async () => {
    const db = como(entorno, PERFILES.admin!)
    await assertFails(db.doc('coleccionInventada/x').set({ a: 1 }))
    await assertFails(db.doc('coleccionInventada/x').get())
  })
})
