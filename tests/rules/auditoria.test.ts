import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  CORREO_ADMIN_EXTERNO,
  PERFILES,
  como,
  comoAdminExterno,
  crearEntorno,
  eventoDePrueba,
  marcaServidor,
  sembrarBase,
} from './ayudas'

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

async function sembrarEvento(): Promise<string> {
  let id = ''
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const ref = await ctx
      .firestore()
      .collection('auditoria')
      .add({ ...eventoDePrueba(PERFILES.analista!), ts: new Date() })
    id = ref.id
  })
  return id
}

describe('auditoria: append-only', () => {
  it('un usuario habilitado puede registrar su propio evento', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.analista!)
        .collection('auditoria')
        .add({ ...eventoDePrueba(PERFILES.analista!), ts: marcaServidor() }),
    )
  })

  it('no se puede registrar un evento en nombre de otro', async () => {
    await assertFails(
      como(entorno, PERFILES.analista!)
        .collection('auditoria')
        .add({ ...eventoDePrueba(PERFILES.admin!), ts: marcaServidor() }),
    )
  })

  it('no se puede antedatar un evento', async () => {
    // Exigir ts == request.time evita que alguien escriba historia falsa.
    await assertFails(
      como(entorno, PERFILES.analista!)
        .collection('auditoria')
        .add({ ...eventoDePrueba(PERFILES.analista!), ts: new Date('2020-01-01') }),
    )
  })

  it('el correo del evento debe ser el del token', async () => {
    await assertFails(
      como(entorno, PERFILES.analista!)
        .collection('auditoria')
        .add({
          ...eventoDePrueba(PERFILES.analista!),
          email: 'otro@clarovtr.cl',
          ts: marcaServidor(),
        }),
    )
  })

  it('el origen debe ser uno de los declarados', async () => {
    await assertFails(
      como(entorno, PERFILES.analista!)
        .collection('auditoria')
        .add({ ...eventoDePrueba(PERFILES.analista!), origen: 'inventado', ts: marcaServidor() }),
    )
  })

  it('ni un admin puede editar un evento', async () => {
    const id = await sembrarEvento()
    await assertFails(
      como(entorno, PERFILES.admin!).doc(`auditoria/${id}`).update({ valorNuevo: 'otra cosa' }),
    )
  })

  it('ni un admin puede borrar un evento', async () => {
    const id = await sembrarEvento()
    await assertFails(como(entorno, PERFILES.admin!).doc(`auditoria/${id}`).delete())
  })

  it('los roles internos leen el log; el contratista no', async () => {
    await sembrarEvento()
    await assertSucceeds(como(entorno, PERFILES.analista!).collection('auditoria').get())
    await assertSucceeds(como(entorno, PERFILES.lector!).collection('auditoria').get())
    await assertFails(como(entorno, PERFILES.contratista!).collection('auditoria').get())
  })
})

describe('usuarios y escalamiento de privilegios', () => {
  it('un usuario nuevo se da de alta solo como lector', async () => {
    const db = entorno
      .authenticatedContext('u-nuevo', { email: 'nuevo@clarovtr.cl', email_verified: true })
      .firestore()

    await assertFails(
      db.doc('usuarios/u-nuevo').set({
        email: 'nuevo@clarovtr.cl',
        nombre: 'Nuevo',
        rol: 'admin',
        celulaId: null,
        proveedorId: null,
        activo: true,
        ultimoAcceso: null,
      }),
    )

    await assertSucceeds(
      db.doc('usuarios/u-nuevo').set({
        email: 'nuevo@clarovtr.cl',
        nombre: 'Nuevo',
        rol: 'lector',
        celulaId: null,
        proveedorId: null,
        activo: true,
        ultimoAcceso: null,
      }),
    )
  })

  it('no se puede crear el perfil de otra persona', async () => {
    const db = entorno
      .authenticatedContext('u-nuevo', { email: 'nuevo@clarovtr.cl', email_verified: true })
      .firestore()
    await assertFails(
      db.doc('usuarios/u-ajeno').set({
        email: 'nuevo@clarovtr.cl',
        nombre: 'Ajeno',
        rol: 'lector',
        celulaId: null,
        proveedorId: null,
        activo: true,
        ultimoAcceso: null,
      }),
    )
  })

  it('un correo externo autorizado se crea como admin', async () => {
    // Es la excepción que permite arrancar: sin ella, una instalación nueva no
    // tendría a nadie capaz de promover al primer administrador.
    await assertSucceeds(
      comoAdminExterno(entorno).doc('usuarios/u-admin-externo').set({
        email: CORREO_ADMIN_EXTERNO,
        nombre: 'Administrador inicial',
        rol: 'admin',
        celulaId: null,
        proveedorId: null,
        activo: true,
        ultimoAcceso: null,
      }),
    )
  })

  it('un correo externo NO autorizado no entra ni como lector', async () => {
    const db = entorno
      .authenticatedContext('u-intruso', { email: 'otro@gmail.com', email_verified: true })
      .firestore()
    await assertFails(
      db.doc('usuarios/u-intruso').set({
        email: 'otro@gmail.com',
        nombre: 'Intruso',
        rol: 'lector',
        celulaId: null,
        proveedorId: null,
        activo: true,
        ultimoAcceso: null,
      }),
    )
  })

  it('un correo corporativo no puede crearse como admin', async () => {
    const db = entorno
      .authenticatedContext('u-nuevo2', { email: 'nuevo2@clarovtr.cl', email_verified: true })
      .firestore()
    await assertFails(
      db.doc('usuarios/u-nuevo2').set({
        email: 'nuevo2@clarovtr.cl',
        nombre: 'Nuevo',
        rol: 'admin',
        celulaId: null,
        proveedorId: null,
        activo: true,
        ultimoAcceso: null,
      }),
    )
  })

  it('nadie se promueve a si mismo', async () => {
    const db = como(entorno, PERFILES.analista!)
    await assertFails(db.doc(`usuarios/${PERFILES.analista!.uid}`).update({ rol: 'admin' }))
    await assertFails(db.doc(`usuarios/${PERFILES.lector!.uid}`).update({ rol: 'admin' }))
  })

  it('el propio usuario solo actualiza su ultimo acceso', async () => {
    const db = como(entorno, PERFILES.analista!)
    await assertSucceeds(
      db.doc(`usuarios/${PERFILES.analista!.uid}`).update({ ultimoAcceso: new Date() }),
    )
    await assertFails(db.doc(`usuarios/${PERFILES.analista!.uid}`).update({ nombre: 'Otro' }))
  })

  it('el admin administra roles', async () => {
    await assertSucceeds(
      como(entorno, PERFILES.admin!).doc(`usuarios/${PERFILES.lector!.uid}`).update({
        rol: 'analista',
        celulaId: 'cel-1',
        proveedorId: null,
        activo: true,
        nombre: 'Lector ascendido',
      }),
    )
  })

  it('el admin no puede quitarse a si mismo el rol de admin', async () => {
    // Si no, la instalacion se queda sin administrador y sin forma de volver.
    await assertFails(
      como(entorno, PERFILES.admin!)
        .doc(`usuarios/${PERFILES.admin!.uid}`)
        .update({ rol: 'analista' }),
    )
  })

  it('un contratista no puede quedar sin proveedor', async () => {
    const admin = como(entorno, PERFILES.admin!)
    await assertFails(
      admin
        .doc(`usuarios/${PERFILES.lector!.uid}`)
        .update({ rol: 'contratista', proveedorId: null }),
    )
    await assertSucceeds(
      admin
        .doc(`usuarios/${PERFILES.lector!.uid}`)
        .update({ rol: 'contratista', proveedorId: 'prov-beta' }),
    )
  })

  it('los usuarios se desactivan, no se borran', async () => {
    const admin = como(entorno, PERFILES.admin!)
    await assertFails(admin.doc(`usuarios/${PERFILES.lector!.uid}`).delete())
    await assertSucceeds(admin.doc(`usuarios/${PERFILES.lector!.uid}`).update({ activo: false }))
  })

  it('el contratista no lee la nomina del equipo', async () => {
    const db = como(entorno, PERFILES.contratista!)
    await assertSucceeds(db.doc(`usuarios/${PERFILES.contratista!.uid}`).get())
    await assertFails(db.collection('usuarios').get())
    await assertFails(db.doc(`usuarios/${PERFILES.admin!.uid}`).get())
  })
})
