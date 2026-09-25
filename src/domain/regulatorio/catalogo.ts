/**
 * Carpetas y documentos del expediente regulatorio de un sitio.
 *
 * La estructura es la que usa Legal/Regulatorio (seis carpetas); el detalle de
 * organismo, norma y plazo sale de la normativa chilena vigente y se cita en
 * cada documento para que quien lo tramita sepa de donde viene la exigencia.
 * Los plazos son referenciales: la PMO los usa para priorizar, no reemplazan
 * la revision de Legal.
 *
 * `aplica` separa lo que corre para todo sitio de lo que solo piden los sitios
 * obligatorios por concurso (localidades comprometidas en los concursos de
 * espectro 700 MHz, 3,5 GHz y similares, y los proyectos FDT).
 *
 * Fuentes: LGT (Ley 18.168, con las Leyes 21.678 y 21.770), LGUC arts. 116 bis
 * E a I (Ley 20.599, "de Torres"), OGUC, Manual de Tramites SUBTEL 2026 (Res.
 * 2614) y las bases de los concursos 3,5 GHz y 700 MHz. Revisado en sept. 2026.
 */

export type AplicaA = 'ambos' | 'normal' | 'concurso'

export interface DocumentoRegulatorio {
  /** Estable: es la clave en Firestore. No se renombra. */
  id: string
  nombre: string
  descripcion: string
  organismo?: string
  norma?: string
  plazo?: string
  /** Solo se exige en ciertos sitios (ver `condicion`). */
  condicional: boolean
  condicion?: string
  aplica: AplicaA
}

export interface CarpetaRegulatoria {
  id: string
  numero: number
  nombre: string
  /** Rotulo corto para la tabla: "Terreno", "DOM"... */
  corto: string
  descripcion: string
  aplica: AplicaA
  documentos: DocumentoRegulatorio[]
}

export const NOTA_COHERENCIA =
  'Toda la documentación debe tener la misma dirección, estructura, altura, coordenadas y medio de transmisión. Una diferencia entre el permiso DOM, el decreto SUBTEL y la recepción de obras es la causa más común de observaciones.'

type Def = Omit<DocumentoRegulatorio, 'condicional' | 'aplica'> &
  Partial<Pick<DocumentoRegulatorio, 'condicional' | 'aplica'>>

const doc = (d: Def): DocumentoRegulatorio => ({
  condicional: false,
  aplica: 'ambos',
  ...d,
  ...(d.condicion ? { condicional: true } : {}),
})

export const CARPETAS_REGULATORIAS: CarpetaRegulatoria[] = [
  {
    id: 'terreno',
    numero: 1,
    nombre: 'Terreno / Propiedad',
    corto: 'Terreno',
    descripcion: 'Documentación que acredita el derecho a utilizar el terreno.',
    aplica: 'ambos',
    documentos: [
      doc({
        id: 'terreno-dominio',
        nombre: 'Título de dominio vigente',
        descripcion: 'Inscripción de dominio con vigencia del inmueble donde está el sitio.',
        organismo: 'Conservador de Bienes Raíces',
      }),
      doc({
        id: 'terreno-arriendo',
        nombre: 'Contrato de arriendo',
        descripcion: 'Contrato con el propietario por el área que ocupa el sitio.',
        condicion: 'si el terreno es arrendado',
        norma: 'Art. 19 bis LGT: es nula la cláusula que impida colocalizar',
      }),
      doc({
        id: 'terreno-comodato',
        nombre: 'Contrato de comodato',
        descripcion: 'Préstamo de uso gratuito del terreno.',
        condicion: 'si el terreno se usa en comodato',
      }),
      doc({
        id: 'terreno-servidumbre-negociacion',
        nombre: 'Negociación de paso de servidumbre',
        descripcion: 'Acuerdo con los propietarios por donde pasa el acceso o la energía.',
        condicion: 'si el acceso o la acometida cruzan un predio de terceros',
        organismo: 'Propietarios / Notaría',
      }),
      doc({
        id: 'terreno-autorizacion-uso',
        nombre: 'Autorización de uso del terreno',
        descripcion: 'Autorización expresa del propietario para instalar la estructura.',
        norma: 'Art. 116 bis F a) LGUC: el propietario firma la solicitud y los planos',
      }),
      doc({
        id: 'terreno-propietario',
        nombre: 'Antecedentes del propietario',
        descripcion: 'Cédula, RUT y personería (si es persona jurídica) del propietario.',
      }),
      doc({
        id: 'terreno-croquis',
        nombre: 'Plano o croquis del área utilizada',
        descripcion: 'Superficie arrendada y paso de servidumbre, con cotas.',
      }),
      doc({
        id: 'terreno-renovaciones',
        nombre: 'Renovaciones o modificaciones del contrato',
        descripcion: 'Anexos, prórrogas o cambios de área posteriores al contrato original.',
        condicion: 'si el contrato se modificó o renovó',
      }),
      doc({
        id: 'terreno-colocalizacion',
        nombre: 'Verificación de colocalización',
        descripcion:
          'Consulta a los dueños de torres cercanas antes de levantar una nueva; respuestas o rechazo.',
        organismo: 'Operadores / dueños de torres',
        norma: 'Art. 19 bis LGT; art. 116 bis I LGUC',
        plazo: 'El requerido responde en 15 días',
        condicion: 'torre nueva (no aplica si se colocaliza)',
      }),
    ],
  },
  {
    id: 'municipal',
    numero: 2,
    nombre: 'Municipal / DOM',
    corto: 'DOM',
    descripcion: 'Todo lo relacionado con la Municipalidad y la Dirección de Obras.',
    aplica: 'ambos',
    documentos: [
      doc({
        id: 'dom-cip',
        nombre: 'Certificado de Informaciones Previas (CIP)',
        descripcion: 'Normas urbanísticas del predio: zona, usos permitidos, restricciones.',
        organismo: 'DOM',
        norma: 'Art. 116 bis F i) LGUC; art. 1.4.4 OGUC',
        plazo: 'La DOM lo emite en 7 días (15 sin catastro)',
      }),
      doc({
        id: 'dom-aviso-vecinos',
        nombre: 'Aviso a vecinos (carta certificada) y plano notarial',
        descripcion:
          'Carta certificada a la junta de vecinos y a los propietarios en un radio de 2 veces la altura de la torre.',
        organismo: 'Correos de Chile / Notaría',
        norma: 'Art. 116 bis F e) y G LGUC',
        plazo: 'Al menos 30 días antes del ingreso (15 si es mimetizada de 3 a 12 m)',
        condicion: 'torre de más de 12 m, o de 3 a 12 m mimetizada',
      }),
      doc({
        id: 'dom-publicacion-diario',
        nombre: 'Inserción en diario regional o provincial',
        descripcion: 'Aviso a la comunidad de la instalación proyectada.',
        norma: 'Art. 116 bis F LGUC',
        plazo: 'Al menos 15 días antes de la solicitud',
        condicion: 'torre de más de 12 m',
      }),
      doc({
        id: 'dom-estructural',
        nombre: 'Proyecto, memoria y cálculo estructural',
        descripcion:
          'Firmados por un profesional competente; la torre debe admitir 1 operador más (bajo 30 m) o 3 más (sobre 30 m).',
        norma: 'Art. 116 bis F b), c) y d) LGUC',
        condicion: 'torre que requiere permiso DOM',
      }),
      doc({
        id: 'dom-numero',
        nombre: 'Certificado de número',
        descripcion: 'Número municipal asignado a la dirección del sitio.',
        organismo: 'DOM',
        condicion: 'si la dirección no tiene número asignado',
      }),
      doc({
        id: 'dom-permiso',
        nombre: 'Permiso de instalación o aviso DOM',
        descripcion:
          'Permiso DOM de la torre, o aviso de instalación (adosada, en poste, sobre edificio de más de 5 pisos, rural o colocalización).',
        organismo: 'DOM',
        norma: 'Arts. 116 bis F, G y H LGUC (Ley 20.599, Ley 21.770)',
        plazo: '15 días hábiles; si la DOM no responde, silencio positivo',
      }),
      doc({
        id: 'dom-recepcion',
        nombre: 'Ingreso de carpeta y recepción DOM',
        descripcion: 'Ingreso de la solicitud de recepción y certificado de recepción final.',
        organismo: 'DOM',
        norma: 'LGUC: el Director de Obras verifica que la torre se ajusta al permiso',
      }),
      doc({
        id: 'dom-compensacion',
        nombre: 'Obra de compensación y su caución',
        descripcion:
          'Mejoras por el 30% del costo de la torre en un radio de 250 m, garantizadas con boleta o póliza a favor del municipio, o diseño armonizado según la votación vecinal.',
        organismo: 'Municipalidad / Concejo',
        norma: 'Art. 116 bis F f) LGUC',
        plazo: 'Ejecutar en 1 año desde el permiso (prórroga única de 6 meses)',
        condicion: 'torre de más de 12 m que no es de catálogo MINVU',
      }),
      doc({
        id: 'dom-resoluciones',
        nombre: 'Resoluciones o certificados municipales',
        descripcion: 'Otros actos municipales asociados al sitio (derechos, mitigaciones).',
        organismo: 'Municipalidad',
        condicion: 'si la municipalidad emitió actos adicionales',
        norma: 'Incluye el acuerdo del Concejo sobre la compensación (20 días corridos)',
      }),
      doc({
        id: 'dom-regularizacion',
        nombre: 'Regularizaciones posteriores',
        descripcion: 'Regularización de obras ejecutadas distintas a lo autorizado.',
        organismo: 'DOM',
        condicion: 'si hubo cambios en obra o faltó un permiso',
        norma: 'LGUC',
      }),
    ],
  },
  {
    id: 'subtel',
    numero: 3,
    nombre: 'SUBTEL / Concesión',
    corto: 'SUBTEL',
    descripcion: 'Documentación regulatoria propia de la torre.',
    aplica: 'ambos',
    documentos: [
      doc({
        id: 'subtel-proyecto-tecnico',
        nombre: 'Solicitud / ingreso del proyecto técnico',
        descripcion: 'Ingreso a SUBTEL de la modificación de concesión con el proyecto técnico.',
        organismo: 'SUBTEL',
        norma: 'Arts. 14 y 15 LGT; Manual de Trámites SUBTEL 2026 (Res. 2614)',
        plazo: 'Reparos de SUBTEL: responder en 30 días hábiles (+15) o se tiene por desistida',
      }),
      doc({
        id: 'subtel-certificado-ingreso',
        nombre: 'Certificado de ingreso SUBTEL',
        descripcion: 'Comprobante del ingreso de la solicitud; lo pide la DOM para el permiso.',
        organismo: 'SUBTEL',
        norma: 'Art. 116 bis F h) LGUC',
      }),
      doc({
        id: 'subtel-extracto-diario-oficial',
        nombre: 'Extracto publicado en el Diario Oficial',
        descripcion: 'Publicación del extracto de la solicitud.',
        organismo: 'Diario Oficial',
        norma: 'Arts. 14 y 15 LGT (Ley 21.678)',
        plazo: 'Publicar en 30 días y enviar la prueba en 5; abre 30 días de oposición',
      }),
      doc({
        id: 'subtel-de-definitivo',
        nombre: 'Decreto (D.E.) definitivo',
        descripcion: 'Decreto que otorga o modifica la concesión con la estación del sitio.',
        organismo: 'SUBTEL / MTT',
        norma: 'Art. 14 LGT; Manual de Trámites SUBTEL §4.6',
        plazo: 'Publicar en el Diario Oficial en 30 días hábiles o se entiende desistida',
      }),
      doc({
        id: 'subtel-de-modificaciones',
        nombre: 'D.E. modificados o rectificaciones',
        descripcion: 'Rectificaciones del decreto (dirección, coordenadas, altura, medio de Tx).',
        organismo: 'SUBTEL',
        condicion: 'si el decreto se modificó o rectificó',
        norma: 'Art. 14 LGT (modificación de concesión)',
      }),
      doc({
        id: 'subtel-ingresos',
        nombre: 'Ingresos SUBTEL asociados',
        descripcion: 'Otros ingresos del sitio (respuestas, complementos, desistimientos).',
        organismo: 'SUBTEL',
        condicion: 'si hubo ingresos adicionales',
      }),
      doc({
        id: 'subtel-anexo',
        nombre: 'Anexo II / Anexo COLO',
        descripcion: 'Anexo técnico de la estación o de colocalización en torre de terceros.',
        organismo: 'SUBTEL',
        norma: 'Art. 19 bis LGT (colocalización)',
      }),
      doc({
        id: 'subtel-oficios',
        nombre: 'Oficios SUBTEL del sitio',
        descripcion: 'Oficios, observaciones y respuestas de SUBTEL relacionados con el sitio.',
        organismo: 'SUBTEL',
        condicion: 'si SUBTEL emitió oficios',
      }),
    ],
  },
  {
    id: 'recepcion',
    numero: 4,
    nombre: 'Recepción / Cierre',
    corto: 'Recepción',
    descripcion:
      'Documentación que demuestra que el sitio quedó ejecutado y cerrado regulatoriamente.',
    aplica: 'ambos',
    documentos: [
      doc({
        id: 'rx-solicitud',
        nombre: 'Ingreso de solicitud de recepción de obras',
        descripcion: 'Solicitud a SUBTEL de recepción de las obras e instalaciones.',
        organismo: 'SUBTEL',
        norma: 'Art. 24 A LGT',
        plazo:
          'Antes de la fecha de inicio de servicio del decreto; en concurso 3,5 GHz, 45 días hábiles antes',
      }),
      doc({
        id: 'rx-oficio',
        nombre: 'Oficio de Recepción de Obras (RxO)',
        descripcion: 'Oficio con que SUBTEL da por recibidas conforme las obras.',
        organismo: 'SUBTEL',
        norma: 'Art. 24 A LGT',
        plazo: 'SUBTEL recibe en 30 días; sin respuesta se puede operar',
      }),
      doc({
        id: 'rx-declaracion-jurada',
        nombre: 'Declaración jurada de obras (en vez de RxO)',
        descripcion:
          'Para las modificaciones que la ley permite, la obra se entiende recibida al día siguiente de declararla.',
        organismo: 'SUBTEL',
        norma: 'Art. 24 A bis LGT (Ley 21.770); confirmar reglamento vigente',
        condicion: 'modificación menor habilitada por el reglamento',
      }),
      doc({
        id: 'rx-acta',
        nombre: 'Acta / certificado de recepción',
        descripcion: 'Acta de la inspección de recepción.',
        organismo: 'SUBTEL',
        condicion: 'si hubo inspección en terreno',
      }),
      doc({
        id: 'rx-planos',
        nombre: 'Planos conforme a obra',
        descripcion: 'As built de la estructura, sala o shelter y acometidas.',
      }),
      doc({
        id: 'rx-coordenadas',
        nombre: 'Coordenadas finales',
        descripcion: 'Coordenadas medidas del sitio ejecutado.',
      }),
      doc({
        id: 'rx-estructura',
        nombre: 'Altura y características finales de la estructura',
        descripcion: 'Tipo, altura y soportes tal como quedaron.',
      }),
      doc({
        id: 'rx-fotos',
        nombre: 'Registro fotográfico',
        descripcion: 'Fotos del sitio terminado: estructura, antenas, equipos, cierre.',
      }),
      doc({
        id: 'rx-modificaciones',
        nombre: 'Documentación de modificaciones ejecutadas',
        descripcion: 'Respaldo de lo que cambió respecto del proyecto autorizado.',
        condicion: 'si la obra difiere del proyecto autorizado',
      }),
      doc({
        id: 'rx-te1',
        nombre: 'Declaración eléctrica SEC (TE1)',
        descripcion:
          'Declaración de la instalación eléctrica interior, hecha por un instalador autorizado en e-declarador.',
        organismo: 'SEC',
        plazo: 'La SEC responde en unos 10 días hábiles',
      }),
      doc({
        id: 'rx-emisiones',
        nombre: 'Cumplimiento de límites de emisión',
        descripcion:
          'Mediciones o cálculo que acreditan que la estación respeta los límites vigentes.',
        organismo: 'SUBTEL',
        norma: 'Art. 7 LGT; norma técnica de límites vigente (confirmar DS 5/2024)',
      }),
    ],
  },
  {
    id: 'especiales',
    numero: 5,
    nombre: 'Casos especiales',
    corto: 'Especiales',
    descripcion: 'Permisos que solo corresponden según el terreno o la ubicación del sitio.',
    aplica: 'ambos',
    documentos: [
      doc({
        id: 'esp-bienes-nacionales',
        nombre: 'Bienes Nacionales: autorización o concesión de uso',
        descripcion: 'Autorización del Ministerio de Bienes Nacionales sobre terreno fiscal.',
        organismo: 'Ministerio de Bienes Nacionales',
        condicion: 'terreno fiscal administrado por Bienes Nacionales',
        norma: 'DL 1.939 (confirmar con Legal)',
      }),
      doc({
        id: 'esp-municipal',
        nombre: 'Terreno municipal: decreto, comodato o autorización',
        descripcion: 'Acto municipal que autoriza el uso de un bien municipal o BNUP.',
        organismo: 'Municipalidad',
        condicion: 'terreno municipal o bien nacional de uso público',
        norma: 'Art. 116 bis F a) LGUC; tarifa según ordenanza',
      }),
      doc({
        id: 'esp-fiscal',
        nombre: 'Terreno fiscal: autorización del organismo propietario',
        descripcion: 'Autorización del servicio público dueño (MOP, FF.AA., otros).',
        condicion: 'terreno de otro organismo del Estado',
      }),
      doc({
        id: 'esp-dgac',
        nombre: 'DGAC: autorización y balizamiento',
        descripcion: 'Pronunciamiento de la DGAC y requisitos de balizamiento de la estructura.',
        organismo: 'DGAC',
        condicion: 'torre que requiere permiso DOM, o cercana a un aeródromo',
        norma: 'Art. 116 bis F g) LGUC',
        plazo: 'Certificado en 10 días hábiles',
      }),
      doc({
        id: 'esp-conaf-patrimonio',
        nombre: 'CONAF / Patrimonio: permisos sectoriales',
        descripcion: 'Permisos en áreas protegidas, zonas típicas o cerca de monumentos.',
        organismo: 'CONAF / Consejo de Monumentos Nacionales',
        condicion: 'área protegida, zona típica o monumento nacional',
        norma: 'Ley 17.288 (Monumentos); Ley 20.283 (bosque nativo)',
      }),
      doc({
        id: 'esp-comunidad',
        nombre: 'Comunidad / terceros: autorización y contrato',
        descripcion: 'Autorización de la comunidad (condominio, comunidad indígena u otra).',
        condicion: 'terreno de una comunidad o de terceros no propietarios',
      }),
      doc({
        id: 'esp-conadi',
        nombre: 'Tierras indígenas: revisión CONADI',
        descripcion:
          'Las tierras de comunidades no se pueden arrendar ni ceder; las de personas indígenas, en arriendo hasta 5 años.',
        organismo: 'CONADI',
        norma: 'Art. 13 Ley 19.253: contravenirlo acarrea nulidad absoluta',
        condicion: 'terreno inscrito en el Registro de Tierras Indígenas',
      }),
      doc({
        id: 'esp-sea',
        nombre: 'SEA: Resolución de Calificación Ambiental (RCA)',
        descripcion: 'La solicitud se admite, pero se exige la RCA antes de instalar.',
        organismo: 'Servicio de Evaluación Ambiental',
        norma: 'Art. 14 LGT; art. 116 bis E LGUC; Ley 19.300',
        condicion: 'sitio dentro de un área protegida',
      }),
      doc({
        id: 'esp-riesgo',
        nombre: 'Estudio de área de riesgo',
        descripcion: 'Estudio validado por el organismo competente, con sus acciones ejecutadas.',
        norma: 'Art. 116 bis E LGUC',
        plazo: 'Acciones ejecutadas antes de la recepción DOM (máximo 12 meses)',
        condicion: 'sitio en área de riesgo del instrumento de planificación',
      }),
      doc({
        id: 'esp-servidumbre-escritura',
        nombre: 'Servidumbre: escritura e inscripción',
        descripcion: 'Escritura pública de la servidumbre inscrita en el Conservador.',
        organismo: 'Notaría / Conservador de Bienes Raíces',
        condicion: 'si hay servidumbre de paso o de energía',
      }),
    ],
  },
  {
    id: 'carpeta-subtel',
    numero: 6,
    nombre: 'Carpeta de recepción del sitio para SUBTEL (localidades)',
    corto: 'Localidad',
    descripcion:
      'Lo que SUBTEL revisa para dar por cumplida una localidad obligatoria del concurso.',
    aplica: 'concurso',
    documentos: [
      doc({
        id: 'loc-carta-conductora',
        nombre: 'Carta conductora',
        descripcion: 'Carta que presenta la carpeta de la localidad a SUBTEL.',
        aplica: 'concurso',
        norma: 'Bases del concurso',
      }),
      doc({
        id: 'loc-cronograma-rxo',
        nombre: 'Cronograma de ingresos de RxO por etapa',
        descripcion: 'Cronograma comprometido de solicitudes de recepción, una por etapa.',
        organismo: 'SUBTEL',
        norma: 'Bases concurso 3,5 GHz, art. 51',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-garantia',
        nombre: 'Garantía de fiel cumplimiento vigente',
        descripcion: 'Boleta de garantía del concurso, vigente hasta la recepción de la localidad.',
        norma: 'Bases del concurso (350.000 UF en 700 MHz, 450.000 UF en 3,5 GHz)',
        plazo: 'Renovar con 30 días hábiles de anticipación',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-decreto-5g',
        nombre: 'Decreto 5G publicado en el Diario Oficial',
        descripcion: 'Decreto de la concesión 5G del concurso, publicado por SUBTEL.',
        organismo: 'SUBTEL / Diario Oficial',
        aplica: 'concurso',
        norma: 'Bases concurso 3,5 GHz',
        plazo: 'Polígonos comprometidos en servicio a 24 meses del decreto',
      }),
      doc({
        id: 'loc-modificacion-5g',
        nombre: 'Modificaciones asociadas al D.E. 5G',
        descripcion: 'Modificaciones del decreto 5G que involucran la localidad.',
        organismo: 'SUBTEL',
        condicion: 'si el D.E. 5G fue modificado',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-decreto-torre',
        nombre: 'Decreto de la torre rectificado (operador)',
        descripcion: 'Decreto de la estación del operador con los datos finales.',
        organismo: 'SUBTEL',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-anexo-colo',
        nombre: 'Anexo COLO con recepción de obras / Anexo II',
        descripcion: 'Anexo técnico de la estación con su recepción.',
        organismo: 'SUBTEL',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-sec-te1',
        nombre: 'SEC (TE1)',
        descripcion: 'Declaración de la instalación eléctrica interior ante la SEC.',
        organismo: 'SEC',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-certificado-electrico',
        nombre: 'Certificado eléctrico',
        descripcion: 'Certificado emitido por el área eléctrica interna.',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-resolucion-700',
        nombre: 'Resolución 700',
        descripcion: 'Resolución de la banda 700 MHz que incluye la localidad.',
        organismo: 'SUBTEL',
        aplica: 'concurso',
        norma: 'Bases concurso 700 MHz: 366 localidades obligatorias (Anexo 12)',
        plazo: 'Servicio en 18 meses desde el otorgamiento',
      }),
      doc({
        id: 'loc-rxo-700',
        nombre: 'Recepción de obras 700',
        descripcion: 'Recepción de obras de la estación en 700 MHz.',
        organismo: 'SUBTEL',
        aplica: 'concurso',
        norma: 'Bases del concurso, arts. 51 y 52; art. 24 A LGT',
        plazo:
          'SUBTEL recibe en 30 días hábiles; corregir observaciones antes del inicio de servicio o se cobra la garantía',
      }),
      doc({
        id: 'loc-resolucion-850',
        nombre: 'Resolución 850',
        descripcion: 'Resolución de la banda 850 MHz que incluye la localidad.',
        organismo: 'SUBTEL',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-rxo-850',
        nombre: 'Recepción de obras 850',
        descripcion: 'Recepción de obras de la estación en 850 MHz.',
        organismo: 'SUBTEL',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-decreto-mmoo',
        nombre: 'Decreto MMOO',
        descripcion: 'Decreto de los medios de operación (transmisión) de la localidad.',
        organismo: 'SUBTEL',
        condicion: 'según corresponda al medio de transmisión',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-rxo-mmoo',
        nombre: 'Recepción de obras MMOO',
        descripcion: 'Recepción de obras de los medios de operación.',
        organismo: 'SUBTEL',
        condicion: 'según corresponda al medio de transmisión',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-decreto-sat',
        nombre: 'Decreto SAT',
        descripcion: 'Decreto del enlace satelital de la localidad.',
        organismo: 'SUBTEL',
        condicion: 'si la localidad se transmite por satélite',
        aplica: 'concurso',
        norma: 'Bases 700 MHz',
      }),
      doc({
        id: 'loc-rxo-sat',
        nombre: 'Recepción de obras SAT',
        descripcion: 'Recepción de obras del enlace satelital.',
        organismo: 'SUBTEL',
        condicion: 'si la localidad se transmite por satélite',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-backhaul',
        nombre: 'Informe técnico del backhaul',
        descripcion: 'Informe certificado por el proveedor del enlace satelital.',
        organismo: 'Proveedor satelital',
        norma: 'Bases concurso 700 MHz',
        plazo: 'Antes de la solicitud de RxO',
        condicion: 'backhaul satelital',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-protocolo-4g700',
        nombre: 'Protocolo estación base 4G 700',
        descripcion: 'Protocolo de pruebas de la estación base en 4G 700 MHz.',
        aplica: 'concurso',
      }),
      doc({
        id: 'loc-protocolo-localidad',
        nombre: 'Protocolo de la localidad',
        descripcion: 'Mediciones de cobertura y servicio en la localidad comprometida.',
        aplica: 'concurso',
        norma:
          'Protocolo de recepción SUBTEL: velocidad y calidad en el 90% del tiempo y de las ubicaciones',
      }),
      doc({
        id: 'loc-protocolo-3g850',
        nombre: 'Protocolo 3G 850',
        descripcion: 'Protocolo de pruebas de la estación en 3G 850 MHz.',
        aplica: 'concurso',
      }),
    ],
  },
]

/** Todos los documentos, para buscar uno por id. */
export const DOCUMENTOS_REGULATORIOS: ReadonlyMap<string, DocumentoRegulatorio> = new Map(
  CARPETAS_REGULATORIAS.flatMap((c) => c.documentos.map((d) => [d.id, d] as const)),
)
