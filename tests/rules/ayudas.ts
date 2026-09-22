import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import { PLANTILLA_ESTANDAR } from '../../src/domain/gates/plantillaEstandar'

export const PROYECTO = 'demo-pmo3000-reglas'

/**
 * Marca de tiempo del servidor. Las reglas exigen ts == request.time para que el
 * historial no se pueda antedatar, asi que los tests deben usar el mismo
 * centinela que usa la app (serverTimestamp), no un Date del cliente.
 */
export const marcaServidor = () => firebase.firestore.FieldValue.serverTimestamp()

function hostPuerto(): { host: string; port: number } {
  const bruto = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  const [host, puerto] = bruto.split(':')
  return { host: host || '127.0.0.1', port: Number(puerto ?? 8080) }
}

export async function crearEntorno(): Promise<RulesTestEnvironment> {
  const { host, port } = hostPuerto()
  return initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host,
      port,
    },
  })
}

export interface PerfilPrueba {
  uid: string
  email: string
  rol: string
  celulaId: string | null
  proveedorId: string | null
  activo?: boolean
}

export const PERFILES: Record<string, PerfilPrueba> = {
  admin: {
    uid: 'u-admin',
    email: 'admin@clarovtr.cl',
    rol: 'admin',
    celulaId: null,
    proveedorId: null,
  },
  jefe: {
    uid: 'u-jefe',
    email: 'jefe@clarovtr.cl',
    rol: 'jefe_celula',
    celulaId: 'cel-1',
    proveedorId: null,
  },
  analista: {
    uid: 'u-analista',
    email: 'analista@clarovtr.cl',
    rol: 'analista',
    celulaId: 'cel-1',
    proveedorId: null,
  },
  contratista: {
    uid: 'u-contra',
    email: 'contra@clarovtr.cl',
    rol: 'contratista',
    celulaId: null,
    proveedorId: 'prov-alfa',
  },
  contratistaBeta: {
    uid: 'u-contra-b',
    email: 'contrab@clarovtr.cl',
    rol: 'contratista',
    celulaId: null,
    proveedorId: 'prov-beta',
  },
  lector: {
    uid: 'u-lector',
    email: 'lector@clarovtr.cl',
    rol: 'lector',
    celulaId: null,
    proveedorId: null,
  },
  inactivo: {
    uid: 'u-inactivo',
    email: 'inactivo@clarovtr.cl',
    rol: 'analista',
    celulaId: null,
    proveedorId: null,
    activo: false,
  },
}

/** Contexto autenticado con correo corporativo verificado. */
export function como(entorno: RulesTestEnvironment, perfil: PerfilPrueba) {
  return entorno
    .authenticatedContext(perfil.uid, { email: perfil.email, email_verified: true })
    .firestore()
}

/** Contexto con correo de otro dominio: debe quedar afuera de todo. */
export function comoExterno(entorno: RulesTestEnvironment) {
  return entorno
    .authenticatedContext('u-externo', { email: 'persona@gmail.com', email_verified: true })
    .firestore()
}

/**
 * Correo externo que SÍ está en correosAdministradores() de firestore.rules.
 * Es la excepción que resuelve el arranque de una instalación nueva.
 */
export const CORREO_ADMIN_EXTERNO = 'javier.neo@gmail.com'

export function comoAdminExterno(entorno: RulesTestEnvironment, uid = 'u-admin-externo') {
  return entorno
    .authenticatedContext(uid, { email: CORREO_ADMIN_EXTERNO, email_verified: true })
    .firestore()
}

/** Contexto corporativo pero sin correo verificado. */
export function comoNoVerificado(entorno: RulesTestEnvironment) {
  return entorno
    .authenticatedContext('u-noverif', { email: 'nuevo@clarovtr.cl', email_verified: false })
    .firestore()
}

export function gatesDePrueba(opciones: {
  gateActual: string
  cerrarActual?: boolean
}): Record<string, unknown> {
  const gates: Record<string, unknown> = {}
  PLANTILLA_ESTANDAR.gates.forEach((definicion) => {
    const esActual = definicion.codigo === opciones.gateActual
    const checklist: Record<string, unknown> = {}
    definicion.checklist.forEach((item) => {
      checklist[item.id] = { ok: false, obs: '', evidenciaUrl: '', por: null, en: null }
    })
    gates[definicion.codigo] = {
      orden: definicion.orden,
      estado: esActual ? (opciones.cerrarActual ? 'completado' : 'en_curso') : 'no_iniciado',
      fechaPlan: '2026-03-01',
      fechaReal: esActual && opciones.cerrarActual ? '2026-03-05' : null,
      fechaBaseline: null,
      responsableUid: 'u-analista',
      proveedorId: 'prov-alfa',
      checklist,
      completadoEn: null,
      completadoPor: null,
    }
  })
  return gates
}

export function seguimientoDePrueba(extra: Record<string, unknown> = {}) {
  return {
    sitioId: 'SITIO-1',
    proyectoId: 'proy-1',
    programaId: 'prog-1',
    portafolioId: 'port-1',
    celulaId: 'cel-1',
    proveedorId: 'prov-alfa',
    responsableUid: 'u-analista',
    sitioNombre: 'Sitio de prueba',
    region: 'Maule',
    comuna: 'Talca',
    lat: -35.4,
    lon: -71.6,
    gateActual: 'TSSR',
    estadoGate: 'en_curso',
    bloqueado: false,
    motivoBloqueo: null,
    prioridad: 'media',
    fechaPlanGateActual: '2026-03-01',
    gates: gatesDePrueba({ gateActual: 'TSSR' }),
    gateTemplateId: PLANTILLA_ESTANDAR.id,
    gateTemplateVersion: 1,
    creadoEn: new Date(),
    creadoPor: 'u-analista',
    actualizadoEn: new Date(),
    actualizadoPor: 'u-analista',
    ...extra,
  }
}

export function eventoDePrueba(perfil: PerfilPrueba, extra: Record<string, unknown> = {}) {
  return {
    entidadTipo: 'sitioProyecto',
    entidadId: 'proy-1__SITIO-1',
    sitioId: 'SITIO-1',
    proyectoId: 'proy-1',
    programaId: 'prog-1',
    accion: 'actualizar',
    campo: 'prioridad',
    valorAnterior: 'media',
    valorNuevo: 'alta',
    detalle: null,
    uid: perfil.uid,
    email: perfil.email,
    nombre: 'Persona de prueba',
    origen: 'ui',
    ...extra,
  }
}

/** Datos base: perfiles, catalogos y dos seguimientos de distinto proveedor. */
export async function sembrarBase(entorno: RulesTestEnvironment): Promise<void> {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()

    for (const perfil of Object.values(PERFILES)) {
      await db.doc(`usuarios/${perfil.uid}`).set({
        email: perfil.email,
        nombre: perfil.uid,
        rol: perfil.rol,
        celulaId: perfil.celulaId,
        proveedorId: perfil.proveedorId,
        activo: perfil.activo ?? true,
        ultimoAcceso: null,
      })
    }

    await db.doc('celulas/cel-1').set({ nombre: 'Celula 1', activa: true })
    await db.doc('proveedores/prov-alfa').set({ nombre: 'Proveedor Alfa', activo: true })
    await db.doc('proveedores/prov-beta').set({ nombre: 'Proveedor Beta', activo: true })
    await db.doc('portafolios/port-1').set({ nombre: 'Portafolio' })
    await db
      .doc('programas/prog-1')
      .set({ nombre: 'Programa', gateTemplateId: PLANTILLA_ESTANDAR.id })
    await db.doc('proyectos/proy-1').set({ nombre: 'Proyecto', programaId: 'prog-1' })
    await db.doc(`gateTemplates/${PLANTILLA_ESTANDAR.id}`).set({
      nombre: PLANTILLA_ESTANDAR.nombre,
      version: 1,
      activo: true,
      gates: PLANTILLA_ESTANDAR.gates,
    })

    await db.doc('sitios/SITIO-1').set({
      nombre: 'Sitio de prueba',
      region: 'Maule',
      comuna: 'Talca',
      direccion: '',
      lat: -35.4,
      lon: -71.6,
      tecnologias: ['4G'],
      tipoSitio: 'Greenfield',
      carpetaUrl: null,
      activo: true,
    })

    await db.doc('sitioProyectos/proy-1__SITIO-1').set(seguimientoDePrueba())
    await db
      .doc('sitioProyectos/proy-2__SITIO-1')
      .set(seguimientoDePrueba({ proyectoId: 'proy-2', proveedorId: 'prov-beta' }))

    await db.doc('tareas/t-1').set({
      titulo: 'Tarea de prueba',
      estado: 'backlog',
      asignadoUid: 'u-analista',
      celulaId: 'cel-1',
      orden: 1000,
    })
  })
}
