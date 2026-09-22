/**
 * Carga datos de ejemplo ANONIMIZADOS en los emuladores.
 *
 * Uso:
 *   npm run emu            # en otra terminal
 *   npm run seed
 *   SEED_SITIOS=4500 npm run seed    # carga a escala real
 *
 * Nunca escribe en la nube: aborta si no detecta los emuladores.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { crearAleatorio } from './generadores/aleatorio'
import {
  CELULAS_DEMO,
  PASSWORD_DEMO,
  PERSONAS_DEMO,
  PORTAFOLIO_DEMO,
  PROGRAMAS_DEMO,
  PROVEEDORES_DEMO,
  PROYECTOS_DEMO,
  TITULOS_TAREA,
  generarSitios,
  type SitioDemo,
} from './generadores/datos'
import { PLANTILLA_ESTANDAR } from '../src/domain/gates/plantillaEstandar'
import { CODIGOS_ESTANDAR as CODIGOS_GATE, type CodigoGate } from '../src/domain/gates/catalogo'
import { hoyEnChile, sumarDias, type FechaISO } from '../src/domain/fechas'
import { idSitioProyecto } from '../src/domain/tipos/sitioProyecto'
import { ESTADOS_TAREA } from '../src/domain/tipos/comunes'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-pmo3000'
const CANTIDAD_SITIOS = Number(process.env.SEED_SITIOS ?? 1200)
const HOY = hoyEnChile()

// --- Guardas: esto jamas debe correr contra la nube -------------------------
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

if (!PROJECT_ID.startsWith('demo-') && process.env.SEED_PERMITIR_NUBE !== 'si') {
  console.error(
    `\nEl projectId "${PROJECT_ID}" no empieza con "demo-".\n` +
      'El seed esta pensado solo para los emuladores. Si de verdad quieres\n' +
      'sembrar otro proyecto, vuelve a ejecutarlo con SEED_PERMITIR_NUBE=si.\n',
  )
  process.exit(1)
}

const app: App = initializeApp({ projectId: PROJECT_ID })
const db = getFirestore(app)
const auth = getAuth(app)
const rng = crearAleatorio(777)

const ts = (iso: FechaISO) => Timestamp.fromDate(new Date(`${iso}T12:00:00Z`))
const sellos = (iso: FechaISO, uid: string) => ({
  creadoEn: ts(iso),
  creadoPor: uid,
  actualizadoEn: ts(iso),
  actualizadoPor: uid,
})

async function verificarEmulador(): Promise<void> {
  try {
    await db.listCollections()
  } catch (e) {
    console.error(
      '\nNo se pudo conectar al emulador de Firestore en ' +
        `${process.env.FIRESTORE_EMULATOR_HOST}.\n` +
        'Levantalo primero con:  npm run emu\n',
    )
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

async function limpiar(): Promise<void> {
  const colecciones = [
    'usuarios',
    'celulas',
    'proveedores',
    'portafolios',
    'programas',
    'proyectos',
    'gateTemplates',
    'sitios',
    'sitioProyectos',
    'tareas',
    'auditoria',
    'config',
  ]
  for (const nombre of colecciones) {
    let borrados = 0
    for (;;) {
      const snap = await db.collection(nombre).limit(400).get()
      if (snap.empty) break
      const batch = db.batch()
      snap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
      borrados += snap.size
      if (snap.size < 400) break
    }
    if (borrados > 0) process.stdout.write(`  limpiado ${nombre}: ${borrados}\n`)
  }
}

async function crearUsuarios(): Promise<void> {
  for (const persona of PERSONAS_DEMO) {
    try {
      await auth.deleteUser(persona.uid)
    } catch {
      // no existia
    }
    // emailVerified: true a proposito. Las reglas exigen correo verificado y el
    // enlace por correo de produccion tambien lo deja verificado.
    await auth.createUser({
      uid: persona.uid,
      email: persona.email,
      emailVerified: true,
      password: persona.password,
      displayName: persona.nombre,
    })

    await db
      .collection('usuarios')
      .doc(persona.uid)
      .set({
        email: persona.email,
        nombre: persona.nombre,
        rol: persona.rol,
        celulaId: persona.celulaId,
        proveedorId: persona.proveedorId,
        activo: true,
        ultimoAcceso: null,
        ...sellos('2026-01-02', 'demo-admin'),
      })
  }
  console.log(`  ${PERSONAS_DEMO.length} usuarios (contrasena de desarrollo: ${PASSWORD_DEMO})`)
}

async function crearCatalogos(): Promise<void> {
  const batch = db.batch()

  CELULAS_DEMO.forEach((c, i) => {
    const lider = PERSONAS_DEMO.find((p) => p.rol === 'jefe_celula' && p.celulaId === c.id)
    batch.set(db.collection('celulas').doc(c.id), {
      nombre: c.nombre,
      descripcion: `Celula ${i + 1} de la PMO de despliegue.`,
      liderUid: lider?.uid ?? null,
      color: c.color,
      activa: true,
      ...sellos('2026-01-02', 'demo-admin'),
    })
  })

  PROVEEDORES_DEMO.forEach((p) => {
    batch.set(db.collection('proveedores').doc(p.id), {
      nombre: p.nombre,
      contactoNombre: `Contacto ${p.nombre}`,
      contactoEmail: `contacto@${p.id}.ficticio.cl`,
      activo: true,
      ...sellos('2026-01-02', 'demo-admin'),
    })
  })

  batch.set(db.collection('portafolios').doc(PORTAFOLIO_DEMO.id), {
    nombre: PORTAFOLIO_DEMO.nombre,
    descripcion: PORTAFOLIO_DEMO.descripcion,
    responsableUid: 'demo-admin',
    periodo: PORTAFOLIO_DEMO.periodo,
    activo: true,
    ...sellos('2026-01-02', 'demo-admin'),
  })

  PROGRAMAS_DEMO.forEach((p) => {
    batch.set(db.collection('programas').doc(p.id), {
      portafolioId: PORTAFOLIO_DEMO.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      gateTemplateId: PLANTILLA_ESTANDAR.id,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      estado: 'en_curso',
      responsableUid: 'demo-admin',
      color: p.color,
      ...sellos('2026-01-02', 'demo-admin'),
    })
  })

  PROYECTOS_DEMO.forEach((p) => {
    const programa = PROGRAMAS_DEMO.find((pr) => pr.id === p.programaId)
    batch.set(db.collection('proyectos').doc(p.id), {
      programaId: p.programaId,
      portafolioId: PORTAFOLIO_DEMO.id,
      nombre: p.nombre,
      descripcion: `Proyecto del programa ${programa?.nombre ?? p.programaId}.`,
      celulaId: p.celulaId,
      proveedorId: p.proveedorId,
      responsableUid: PERSONAS_DEMO.find((x) => x.celulaId === p.celulaId)?.uid ?? null,
      fechaInicio: programa?.fechaInicio ?? null,
      fechaFin: programa?.fechaFin ?? null,
      estado: 'en_curso',
      ...sellos('2026-01-05', 'demo-admin'),
    })
  })

  batch.set(db.collection('gateTemplates').doc(PLANTILLA_ESTANDAR.id), {
    nombre: PLANTILLA_ESTANDAR.nombre,
    descripcion: PLANTILLA_ESTANDAR.descripcion,
    version: PLANTILLA_ESTANDAR.version,
    activo: true,
    gates: PLANTILLA_ESTANDAR.gates,
    ...sellos('2026-01-02', 'demo-admin'),
  })

  batch.set(db.collection('config').doc('app'), {
    dominioPermitido: 'clarovtr.cl',
    asuntoCarpeta: 'CREAR_CARPETA | {programa} | {sitioId} | {nombre}',
    umbralSobrecargaTareas: 8,
    ...sellos('2026-01-02', 'demo-admin'),
  })

  await batch.commit()
  console.log(
    `  ${CELULAS_DEMO.length} celulas, ${PROVEEDORES_DEMO.length} proveedores, ` +
      `${PROGRAMAS_DEMO.length} programas, ${PROYECTOS_DEMO.length} proyectos, 1 plantilla`,
  )
}

interface ResultadoSeguimientos {
  seguimientos: number
  eventos: number
}

/** Avance realista: la mayoria de los sitios esta a mitad de camino. */
const PESOS_GATE = [10, 18, 16, 20, 10, 8, 10, 8]

async function crearSitiosYSeguimientos(sitios: SitioDemo[]): Promise<ResultadoSeguimientos> {
  const escritor = db.bulkWriter()
  escritor.onWriteError((error) => error.failedAttempts < 4)

  const analistas = PERSONAS_DEMO.filter((p) => p.rol === 'analista')
  let seguimientos = 0
  let eventos = 0

  sitios.forEach((sitio, indice) => {
    escritor.set(db.collection('sitios').doc(sitio.id), {
      nombre: sitio.nombre,
      region: sitio.region,
      comuna: sitio.comuna,
      direccion: sitio.direccion,
      lat: sitio.lat,
      lon: sitio.lon,
      tecnologias: sitio.tecnologias,
      tipoSitio: sitio.tipoSitio,
      carpetaUrl: null,
      activo: true,
      ...sellos('2026-01-08', 'demo-admin'),
    })

    // Cada sitio entra a 1 proyecto, y 1 de cada 8 participa en 2 programas
    // distintos (para ejercitar el modelo maestro + participacion).
    const proyectos = [PROYECTOS_DEMO[indice % PROYECTOS_DEMO.length]!]
    if (indice % 8 === 0) {
      const otro = PROYECTOS_DEMO[(indice + 3) % PROYECTOS_DEMO.length]!
      if (otro.programaId !== proyectos[0]!.programaId) proyectos.push(otro)
    }

    for (const proyecto of proyectos) {
      const responsable = rng.elegir(analistas)

      const hasta = rng.ponderado(PESOS_GATE)
      const gateActual: string = hasta >= CODIGOS_GATE.length ? 'CERRADO' : CODIGOS_GATE[hasta]!
      const bloqueado = gateActual !== 'CERRADO' && rng.probabilidad(0.05)

      // La fecha de inicio se calcula HACIA ATRAS desde hoy: se elige cuando
      // vence el gate en curso (entre 60 dias antes y 60 despues) y de ahi se
      // resta el SLA acumulado. Asi el tablero queda con una mezcla realista de
      // sitios a tiempo, por vencer y atrasados, en vez de todos en rojo.
      const indiceReferencia = Math.min(hasta, PLANTILLA_ESTANDAR.gates.length - 1)
      let slaAcumulado = 0
      for (let i = 0; i <= indiceReferencia; i += 1) {
        slaAcumulado += PLANTILLA_ESTANDAR.gates[i]!.slaDias
      }
      const vencimientoObjetivo = sumarDias(HOY, rng.entero(-60, 60))
      const fechaInicio = sumarDias(vencimientoObjetivo, -slaAcumulado)

      // Fechas plan encadenadas por SLA.
      const gates: Record<string, unknown> = {}
      const planes: Partial<Record<CodigoGate, FechaISO>> = {}
      let acumulado: FechaISO = fechaInicio
      for (const definicion of PLANTILLA_ESTANDAR.gates) {
        acumulado = sumarDias(acumulado, definicion.slaDias)
        planes[definicion.codigo] = acumulado
      }

      PLANTILLA_ESTANDAR.gates.forEach((definicion, i) => {
        const plan = planes[definicion.codigo]!
        const cerrado = i < hasta
        const enCurso = i === hasta

        const checklist: Record<string, unknown> = {}
        for (const item of definicion.checklist) {
          // Gate cerrado: todo cumplido. Gate en curso: avance parcial.
          const ok = cerrado || (enCurso && rng.probabilidad(0.45))
          checklist[item.id] = {
            ok,
            obs: '',
            evidenciaUrl:
              ok && item.requiereEvidencia
                ? `https://ejemplo.local/${sitio.id}/${item.id}.pdf`
                : '',
            por: ok ? responsable.uid : null,
            en: ok ? ts(plan) : null,
          }
        }

        // La fecha real se desvia del plan: asi el scorecard tiene de que hablar.
        const desvio = rng.entero(-4, 14)
        const fechaReal = cerrado ? sumarDias(plan, desvio) : null

        gates[definicion.codigo] = {
          orden: definicion.orden,
          estado: cerrado
            ? 'completado'
            : enCurso
              ? bloqueado
                ? 'bloqueado'
                : 'en_curso'
              : 'no_iniciado',
          fechaPlan: plan,
          fechaReal,
          fechaBaseline: null,
          responsableUid: responsable.uid,
          proveedorId: proyecto.proveedorId,
          checklist,
          completadoEn: cerrado ? ts(fechaReal ?? plan) : null,
          completadoPor: cerrado ? responsable.uid : null,
        }
      })

      const id = idSitioProyecto(proyecto.id, sitio.id)
      escritor.set(db.collection('sitioProyectos').doc(id), {
        sitioId: sitio.id,
        proyectoId: proyecto.id,
        programaId: proyecto.programaId,
        portafolioId: PORTAFOLIO_DEMO.id,
        celulaId: proyecto.celulaId,
        proveedorId: proyecto.proveedorId,
        responsableUid: responsable.uid,
        sitioNombre: sitio.nombre,
        region: sitio.region,
        comuna: sitio.comuna,
        lat: sitio.lat,
        lon: sitio.lon,
        gateActual,
        estadoGate: gateActual === 'CERRADO' ? 'completado' : bloqueado ? 'bloqueado' : 'en_curso',
        bloqueado,
        motivoBloqueo: bloqueado ? 'Pendiente de permiso municipal' : null,
        prioridad: rng.elegir(['baja', 'media', 'media', 'alta', 'critica'] as const),
        fechaPlanGateActual:
          gateActual === 'CERRADO' ? null : (planes[gateActual as CodigoGate] ?? null),
        gates,
        gateTemplateId: PLANTILLA_ESTANDAR.id,
        gateTemplateVersion: PLANTILLA_ESTANDAR.version,
        ...sellos('2026-01-08', 'demo-admin'),
      })
      seguimientos += 1

      // Historial: un evento por gate cerrado, para que la ficha tenga pasado.
      for (let i = 0; i < hasta; i += 1) {
        const desde = CODIGOS_GATE[i]!
        const hacia = i + 1 >= CODIGOS_GATE.length ? 'CERRADO' : CODIGOS_GATE[i + 1]!
        const cuando = (gates[desde] as { fechaReal: FechaISO | null }).fechaReal ?? planes[desde]!
        escritor.set(db.collection('auditoria').doc(), {
          entidadTipo: 'sitioProyecto',
          entidadId: id,
          sitioId: sitio.id,
          proyectoId: proyecto.id,
          programaId: proyecto.programaId,
          accion: 'cambio_gate',
          campo: 'gateActual',
          valorAnterior: desde,
          valorNuevo: hacia,
          detalle: `Cierre con fecha real ${cuando}`,
          uid: responsable.uid,
          email: responsable.email,
          nombre: responsable.nombre,
          ts: ts(cuando),
          origen: 'seed',
        })
        eventos += 1
      }
    }
  })

  await escritor.close()
  return { seguimientos, eventos }
}

async function crearTareas(sitios: SitioDemo[]): Promise<number> {
  const escritor = db.bulkWriter()
  const personas = PERSONAS_DEMO.filter((p) => p.rol === 'analista' || p.rol === 'jefe_celula')
  const cantidad = Math.min(220, sitios.length)

  for (let i = 0; i < cantidad; i += 1) {
    const sitio = sitios[rng.entero(0, sitios.length - 1)]!
    const proyecto = PROYECTOS_DEMO[rng.entero(0, PROYECTOS_DEMO.length - 1)]!
    const persona = rng.elegir(personas)
    // Un par de personas queda deliberadamente sobrecargada para que la alerta
    // de carga del equipo (Fase 3) tenga algo que mostrar.
    const asignado = rng.probabilidad(0.3) ? (personas[0] ?? persona) : persona

    escritor.set(db.collection('tareas').doc(), {
      titulo: rng.elegir(TITULOS_TAREA),
      descripcion: `Tarea de ejemplo asociada al sitio ${sitio.id}.`,
      estado: rng.elegir(ESTADOS_TAREA),
      asignadoUid: asignado.uid,
      celulaId: asignado.celulaId ?? proyecto.celulaId,
      sitioId: sitio.id,
      sitioProyectoId: idSitioProyecto(proyecto.id, sitio.id),
      proyectoId: proyecto.id,
      programaId: proyecto.programaId,
      gateCodigo: rng.elegir(CODIGOS_GATE),
      prioridad: rng.elegir(['baja', 'media', 'alta', 'critica'] as const),
      fechaInicio: sumarDias(HOY, rng.entero(-30, 0)),
      fechaVencimiento: sumarDias(HOY, rng.entero(-10, 40)),
      estimacionHoras: rng.entero(2, 40),
      orden: (i + 1) * 1000,
      etiquetas: [],
      dependencias: [],
      ...sellos('2026-01-10', 'demo-admin'),
    })
  }

  await escritor.close()
  return cantidad
}

/** Publica los usuarios de prueba para el atajo "entrar como" del login. */
function publicarUsuariosDemo(): void {
  const destino = resolve(process.cwd(), 'public')
  mkdirSync(destino, { recursive: true })
  writeFileSync(
    resolve(destino, 'dev-usuarios.json'),
    JSON.stringify(
      PERSONAS_DEMO.map((p) => ({
        email: p.email,
        password: p.password,
        nombre: p.nombre,
        rol: p.rol,
        proveedor: p.proveedorId,
      })),
      null,
      2,
    ),
  )
}

/** Archivos de ejemplo para probar el importador a escala real. */
async function generarArchivosEjemplo(cantidad: number): Promise<void> {
  const destino = resolve(process.cwd(), 'datos-ejemplo')
  mkdirSync(destino, { recursive: true })

  const sitios = generarSitios(cantidad, 98765)
  const cabeceras = [
    'ID Sitio',
    'Nombre',
    'Region',
    'Comuna',
    'Direccion',
    'Latitud',
    'Longitud',
    'Tecnologia',
    'Tipo Sitio',
    'Programa',
    'Proveedor',
    'Fecha Inicio',
  ]

  const filas = sitios.map((s, i) => [
    // Prefijo distinto para no chocar con los IDs sembrados: la primera carga
    // es de sitios nuevos y la segunda demuestra la deteccion de duplicados.
    `IMP-${s.id}`,
    s.nombre,
    s.region,
    s.comuna,
    s.direccion,
    // A proposito con coma decimal: es como sale de Excel en Chile.
    String(s.lat).replace('.', ','),
    String(s.lon).replace('.', ','),
    s.tecnologias.join('/'),
    s.tipoSitio,
    PROGRAMAS_DEMO[i % PROGRAMAS_DEMO.length]!.nombre,
    PROVEEDORES_DEMO[i % PROVEEDORES_DEMO.length]!.nombre,
    `${String((i % 28) + 1).padStart(2, '0')}-0${(i % 9) + 1}-2026`,
  ])

  // Filas con problemas a proposito, para ejercitar la vista previa.
  filas.push([
    `IMP-${sitios[0]!.id}`,
    'Duplicado del archivo',
    'Maule',
    'Talca',
    '',
    '-35,4',
    '-71,6',
    '4G',
    'Rooftop',
    'Plan 200 sitios nuevos',
    'Proveedor Alfa',
    '15-03-2026',
  ])
  filas.push([
    '',
    'Sin ID de sitio',
    'Maule',
    'Talca',
    '',
    '-35,4',
    '-71,6',
    '4G',
    'Rooftop',
    '',
    '',
    '',
  ])
  filas.push([
    'IMP-ERR-0002',
    'Coordenada no numerica',
    'Maule',
    'Talca',
    '',
    'sin dato',
    '-71,6',
    '4G',
    'Rooftop',
    '',
    '',
    '',
  ])
  filas.push([
    'IMP-ERR-0003',
    'Fuera de Chile',
    'Maule',
    'Talca',
    '',
    '40,41',
    '-3,70',
    '4G',
    'Rooftop',
    '',
    '',
    '',
  ])

  const csv = [cabeceras, ...filas]
    .map((fila) => fila.map((c) => (String(c).includes(';') ? `"${c}"` : c)).join(';'))
    .join('\n')
  // El BOM va a proposito: sin el, Excel en Windows abre el CSV como ANSI y
  // las tildes y la enie llegan corruptas.
  writeFileSync(resolve(destino, 'sitios-ejemplo.csv'), `\uFEFF${csv}`, 'utf8')

  const XLSX = await import('@e965/xlsx')
  const libro = XLSX.utils.book_new()
  const hoja = XLSX.utils.aoa_to_sheet([cabeceras, ...filas])
  XLSX.utils.book_append_sheet(libro, hoja, 'Maestro')
  // writeFile de SheetJS necesita registrar fs en ESM; escribir el buffer a mano
  // evita esa dependencia.
  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  writeFileSync(resolve(destino, 'sitios-ejemplo.xlsx'), buffer)
}

async function main(): Promise<void> {
  const inicio = Date.now()
  console.log(`\nSeed PMO3000 -> proyecto ${PROJECT_ID}`)
  console.log(
    `Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}   Auth: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}\n`,
  )

  await verificarEmulador()

  console.log('Limpiando datos previos...')
  await limpiar()

  console.log('Creando usuarios...')
  await crearUsuarios()

  console.log('Creando catalogos...')
  await crearCatalogos()

  console.log(`Generando ${CANTIDAD_SITIOS} sitios y su seguimiento...`)
  const sitios = generarSitios(CANTIDAD_SITIOS)
  const { seguimientos, eventos } = await crearSitiosYSeguimientos(sitios)
  console.log(
    `  ${sitios.length} sitios, ${seguimientos} seguimientos, ${eventos} eventos de auditoria`,
  )

  console.log('Creando tareas...')
  const tareas = await crearTareas(sitios)
  console.log(`  ${tareas} tareas`)

  console.log('Publicando atajo de desarrollo y archivos de ejemplo...')
  publicarUsuariosDemo()
  await generarArchivosEjemplo(4500)
  console.log('  public/dev-usuarios.json')
  console.log('  datos-ejemplo/sitios-ejemplo.csv y .xlsx (4.500 filas)')

  console.log(`\nListo en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`)
  console.log(`Entra con cualquier correo demo.*@clarovtr.cl y la contrasena ${PASSWORD_DEMO},`)
  console.log('o usa el boton "Entrar como" del login.\n')
  process.exit(0)
}

main().catch((e) => {
  console.error('\nEl seed fallo:')
  console.error(e)
  process.exit(1)
})
