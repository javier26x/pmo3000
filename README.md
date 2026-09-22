# PMO3000 — Gestión del despliegue de red móvil

Herramienta de la PMO para llevar el despliegue de sitios (estaciones base) por
gates secuenciales, con trazabilidad de cada cambio y uso en terreno desde el
celular.

La unidad de trabajo es el **sitio dentro de un proyecto**, y el negocio está en
la secuencia de gates:

```
TCSR → FC → RFI → Implementación → D+1 → D+7 → SSV → Cerrado
```

Un sitio no pasa al siguiente gate sin cumplir los entregables obligatorios del
actual. La plantilla de gates y su checklist son configurables por programa.

**Estado: Fase 1 terminada.** Incluye autenticación y roles, maestro de sitios
con importación desde Excel/CSV, mapa, gates con checklist, ficha de sitio,
kanban, auditoría y datos de ejemplo. Gantt, RAID, reporte PPT y el correo para
crear carpetas llegan en la Fase 2.

---

## 1. Partir en 3 comandos

Con Node 20.19+ y Java 11+ instalados (Java lo necesita el emulador de Firestore):

```bash
npm install
npm install -g firebase-tools
cp .env.example .env
```

Después, en **dos terminales**:

```bash
# Terminal 1 — emuladores de Firebase (Auth + Firestore + UI)
npm run emu
```

```bash
# Terminal 2 — datos de ejemplo y aplicación
npm run seed
npm run dev
```

Abre <http://localhost:5173>. En el login aparece el bloque **«Atajo de
desarrollo — entrar como»** con los 13 usuarios ficticios: un clic y entras. La
contraseña de todos es `demo1234` y solo existen en el emulador.

| Para entrar como | Correo                              | Rol                          |
| ---------------- | ----------------------------------- | ---------------------------- |
| Administrador    | `demo.admin@clarovtr.cl`            | admin                        |
| Jefe de célula   | `demo.jefe.rf@clarovtr.cl`          | jefe_celula                  |
| Analista         | `demo.analista1@clarovtr.cl`        | analista                     |
| Contratista      | `demo.contratista.alfa@clarovtr.cl` | contratista (Proveedor Alfa) |
| Lector           | `demo.lector@clarovtr.cl`           | lector                       |

Todo junto en una sola terminal:

```bash
npm run dev:full   # levanta emuladores + app (el seed se corre aparte)
```

---

## 2. Todos los comandos

```bash
# --- desarrollo ---------------------------------------------------------
npm run dev                 # app en http://localhost:5173
npm run emu                 # emuladores: Auth 9099, Firestore 8080, UI 4000
npm run emu:persistente     # emuladores guardando los datos entre reinicios
npm run seed                # datos de ejemplo anonimizados (requiere emuladores)
npm run dev:full            # emuladores + app en paralelo

# --- calidad ------------------------------------------------------------
npm run typecheck           # tsc --noEmit
npm run lint                # ESLint
npm run lint:fix
npm run format              # Prettier
npm run test                # pruebas de dominio (rápidas, sin Firebase)
npm run test:watch
npm run test:rules          # reglas de Firestore (levanta su propio emulador)
npm run test:rules:conectado # reglas usando el emulador que ya tienes arriba

# --- producción ---------------------------------------------------------
npm run build               # typecheck + build en dist/
npm run preview             # sirve dist/ en http://localhost:4173
```

### Volumen del seed

```bash
npm run seed                    # 1.200 sitios (rápido, ~16 s)
SEED_SITIOS=4500 npm run seed   # volumen real del maestro
```

El seed además genera, en `datos-ejemplo/`, una planilla de prueba de **4.500
filas** en `.csv` y `.xlsx` —con cuatro filas defectuosas a propósito— para
ejercitar el importador a escala real.

---

## 3. Conectar con el proyecto real (`pmoclr`)

El repositorio ya trae dos destinos separados, para que no se pueda desplegar
por accidente:

| Alias        | Proyecto       | Se usa en                                       |
| ------------ | -------------- | ----------------------------------------------- |
| `default`    | `demo-pmo3000` | emuladores (`npm run emu`, `npm run seed`)      |
| `produccion` | `pmoclr`       | los comandos de despliegue, siempre nombrándolo |

`npm run dev` lee `.env` (emuladores) y `npm run build` lee `.env.production`
(proyecto real). Nunca se mezclan.

### 3.1 Recrear `.env.production`

Está en `.gitignore`, así que en una máquina nueva hay que crearlo. La
configuración web de Firebase **no es secreta** —viaja en el bundle de cualquier
app web y así está diseñada; lo que protege los datos son las reglas de
Firestore— pero se deja fuera del repositorio para que nadie la confunda con una
credencial.

```bash
cat > .env.production << 'EOF'
VITE_USAR_EMULADORES=false
VITE_FIREBASE_PROJECT_ID=pmoclr
VITE_FIREBASE_API_KEY=AIzaSyDsYXf-hL7i0bc78RPPePD1VMf5spJjPhs
VITE_FIREBASE_AUTH_DOMAIN=pmoclr.firebaseapp.com
VITE_FIREBASE_APP_ID=1:311927873870:web:9f01dafcd4307ee7593e1f
VITE_FIREBASE_STORAGE_BUCKET=pmoclr.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=311927873870
VITE_DOMINIO_PERMITIDO=clarovtr.cl
VITE_CORREOS_ADMIN=javier.neo@gmail.com
EOF
```

`VITE_CORREOS_ADMIN` es la lista de correos externos que además entran como
administradores. **Tiene que decir lo mismo que `correosAdministradores()` en
`firestore.rules`**: el cliente decide qué rol se escribe al crear el perfil y
las reglas deciden si aceptan ese rol; si las dos listas no coinciden, el ingreso
falla con un error de permisos.

Si falta este archivo, `npm run build` **falla a propósito** con un mensaje que
dice qué variable falta. Antes no fallaba: se publicaba un sitio que compilaba
bien y recién al intentar entrar respondía
`auth/api-key-not-valid`, porque el bundle se llevaba los valores de ejemplo.

### 3.2 Autenticarse

```bash
npm install -g firebase-tools
firebase login
# En un servidor sin navegador:
# firebase login --no-localhost
```

### 3.3 Crear la base de datos de Firestore

> ### ⚠️ La región es permanente
>
> Se elige al crear la base y **no se puede cambiar después**: para moverla hay
> que crear otro proyecto y migrar los datos. Elige **`southamerica-west1`
> (Santiago)**; si no aparece en el selector, **`southamerica-east1` (São Paulo)**.

Primero revisa si ya existe y en qué región quedó:

```bash
firebase firestore:databases:list --project pmoclr
```

Si no existe, créala. Desde la consola es **Firestore Database → Crear base de
datos → modo producción → región**, o por línea de comandos:

```bash
firebase firestore:databases:create "(default)"   --location southamerica-west1 --project pmoclr
```

### 3.4 Habilitar el ingreso por correo

Esto no tiene comando; va en la consola de Firebase, proyecto `pmoclr`:

1. **Authentication → Sign-in method → Correo electrónico/contraseña**: habilítalo
   y, dentro de esa misma opción, activa **Vínculo de correo (inicio de sesión sin
   contraseña)**. Puedes dejar la contraseña deshabilitada: la app usa el enlace.
2. **Authentication → Settings → Dominios autorizados**: `pmoclr.web.app` y
   `pmoclr.firebaseapp.com` ya vienen autorizados. Agrega aquí tu dominio propio
   si vas a publicar en uno.

### 3.5 Desplegar

> Ningún comando del repositorio despliega solo: estos los ejecutas tú.

**Las reglas y los índices van primero.** Sin ellos la app no puede leer nada, y
la pantalla de auditoría necesita índices compuestos que hay que crear antes de
usarla.

```bash
npm run deploy:rules      # reglas + índices
npm run deploy:hosting    # build + hosting
```

O ambas cosas de una:

```bash
npm run deploy
```

Queda publicada en <https://pmoclr.web.app>.

### 3.6 El primer administrador

Toda persona que entra por primera vez queda con rol **lector** — así lo exigen
las reglas, para que nadie se autoasigne permisos. El primer admin se promueve a
mano, una sola vez:

1. Entra a la app con tu correo `@clarovtr.cl`. Te llega el enlace de ingreso y, al
   abrirlo, se crea tu perfil como lector.
2. Consola de Firebase → **Firestore → colección `usuarios`** → busca tu
   documento (el id es tu UID) y cambia `rol` de `lector` a `admin`.
3. Recarga la app: desde ahí administras los demás roles en **Usuarios**.

### 3.7 Dejar la base lista (desde la app, no desde la consola)

La base parte vacía: el seed es solo para emuladores y nunca escribe en la nube
(aborta si el projectId no empieza con `demo-`). Todo lo que hace falta se crea
desde **Configuración**, que solo ve un administrador, en este orden:

1. **Plantilla de gates** → botón _Crear la plantilla estándar_. Deja lista la
   secuencia TCSR → FC → RFI → Implementación → D+1 → D+7 → SSV con sus 29
   entregables. Sin ella ningún sitio puede entrar en seguimiento.
2. **Portafolio** → ej. «Portafolio Despliegue 2026».
3. **Programas** → ej. «Plan 200 sitios nuevos». Ojo: el nombre que pongas aquí
   es el que la importación busca en la columna _Programa_ de tu planilla.
4. **Proyectos** → el tramo de cada programa al que se incorporan los sitios.
5. **Células** y **Proveedores** → se pueden agregar cuando quieras; los
   proveedores hacen falta antes de dar de alta usuarios con rol contratista.

Los identificadores se generan legibles a partir del nombre
(`prog-plan-200-sitios-nuevos`), así que la consola de Firestore y la auditoría
se leen sin tener que traducir.

Después, **Importar** carga el maestro de sitios desde tu Excel o CSV.

### 3.8 App Check, antes de los datos reales

La clave de API es pública por diseño (viaja en el bundle de cualquier app web).
Lo que impide que alguien use tu backend desde fuera de tu aplicación no es
esconderla, sino **App Check**. Está en la lista de Fase 3, y vale la pena
activarlo antes de que la herramienta tenga el despliegue completo cargado.

---

## 4. Cómo está construido

```
src/
├─ domain/      TypeScript puro + Zod. Tipos, máquina de gates, cálculo de
│               atraso, permisos, validación de importación. Sin Firebase.
├─ data/        Única capa que habla con Firebase: converters, repositorios,
│               escritura de auditoría.
├─ hooks/       Puente reactivo con onSnapshot y los proveedores de contexto.
├─ features/    UI por módulo. Compone hooks y componentes.
└─ components/  Sistema de diseño propio.
```

Dos reglas de arquitectura, verificadas por ESLint (no son solo una convención):

- Ningún archivo de `features/`, `components/` o `app/` puede importar `firebase/*`.
- `domain/` no puede importar Firebase ni ninguna capa superior.

La lógica de negocio vive en `domain/gates/maquina.ts`, que es **pura**: recibe
el estado y devuelve un parche más los eventos de auditoría que corresponden. El
repositorio los aplica en un solo `writeBatch`, de modo que el cambio y su rastro
entran juntos o no entran.

Cuando en la Fase 2 entren las Cloud Functions, la implementación del repositorio
pasa de `writeBatch` a `httpsCallable` **sin tocar `domain/` ni `features/`**.

Documentación de detalle en [`docs/`](docs/):

- [`docs/modelo-datos.md`](docs/modelo-datos.md) — colecciones, campos e índices de las 3 fases.
- [`docs/reglas-seguridad.md`](docs/reglas-seguridad.md) — qué garantizan las reglas y qué no.
- [`docs/importacion-excel.md`](docs/importacion-excel.md) — formato de la planilla y cómo funciona el importador.
- [`docs/power-automate-carpetas.md`](docs/power-automate-carpetas.md) — carpetas de SharePoint sin Graph API (Fase 2).
- [`docs/decisiones/`](docs/decisiones/) — decisiones de diseño con su porqué:
  [sitio y participación](docs/decisiones/0001-sitio-y-participacion.md) ·
  [gates embebidos](docs/decisiones/0002-gates-embebidos.md) ·
  [fechas como día civil](docs/decisiones/0003-fechas-como-dia-civil.md) ·
  [filtros en la URL](docs/decisiones/0004-filtros-en-la-url.md).

---

## 5. Cómo se usa (y por qué está diseñada así)

Es una herramienta de trabajo diario, no un panel de consulta. El diseño asume a
alguien que entra varias veces al día, revisa cientos de sitios y necesita llegar
rápido a uno concreto.

### Sin soltar el teclado

| Atajo                                       | Qué hace                                                        |
| ------------------------------------------- | --------------------------------------------------------------- |
| `Ctrl/⌘ K`                                  | Paleta de comandos: buscar un sitio o ejecutar cualquier acción |
| `/`                                         | Buscar en la vista actual                                       |
| `G` luego `S` / `M` / `K` / `I` / `A` / `U` | Ir a Sitios, Mapa, Kanban, Importar, Auditoría, Usuarios        |
| `J` / `K` o `↑` `↓`                         | Recorrer las filas de la tabla                                  |
| `Enter`                                     | Abrir la ficha de la fila marcada                               |
| `T`                                         | Alternar modo claro y oscuro                                    |
| `D`                                         | Cambiar la densidad de las tablas                               |
| `?`                                         | Ver esta lista dentro de la app                                 |

Los atajos nunca se activan mientras se escribe en un campo.

### Los filtros están en la URL

El recorte que armas queda en la barra de direcciones
(`/sitios?prog=prog-plan200&gate=FC&atr=1`). Eso significa que:

- **Compartes una vista pegando el enlace.** «Mira los atrasados del Plan 200» es
  un link, no una instrucción.
- **Recargar no pierde el filtrado**, y el botón Atrás deshace el último filtro.
- **Saltar entre tabla, mapa y kanban conserva el recorte**: son tres miradas de
  lo mismo.

Además, cualquier combinación se guarda con nombre desde el menú **Vistas**
(queda en tu navegador, no en Firestore: es una preferencia personal).

### El embudo del despliegue

Arriba de la tabla hay una barra proporcional con los sitios parados en cada
gate, y una franja roja dentro de cada tramo con la parte que está atrasada.
Responde de un vistazo la pregunta que abre toda reunión de PMO: dónde se está
atascando esto. Cada tramo filtra la vista al pulsarlo, y sigue mostrando la
distribución completa aunque haya un gate seleccionado.

### En terreno

- **Funciona sin señal.** Firestore guarda una caché persistente en el
  dispositivo: se sigue consultando y editando sin conexión, y los cambios suben
  solos al volver la señal. La barra superior avisa cuando estás sin conexión o
  sincronizando.
- **La tabla se vuelve tarjetas** bajo 768 px, y la ficha con su checklist es la
  pantalla pensada para el celular.
- Si el mapa no puede cargar sus imágenes (sin señal, o una red que bloquea
  OpenStreetMap), lo dice en vez de quedarse en blanco.

### Carga

El documento de seguimiento pesa 4,85 kB y el 86 % de eso es el checklist de los
gates, que la tabla no muestra. Mientras eso no cambie (ver
[ADR 0002](docs/decisiones/0002-gates-embebidos.md)), la app pide la consulta en
dos tandas: 150 documentos para pintar rápido y 1.500 por detrás. Medido contra
el emulador, el primer pintado pasó de 8,5 s a 4,3 s, y el embudo avisa
«cargando el resto…» para que nadie tome un conteo parcial por el total.

---

## 6. Límites conocidos de la Fase 1

Están acá y no escondidos en el código, porque cambian cómo hay que operar la app.

### La auditoría se escribe desde el cliente

Sin Cloud Functions (plan Spark), el evento de auditoría se escribe desde el
navegador en el **mismo `writeBatch`** que el cambio: es atómico, o entran ambos
o ninguno. Las reglas exigen que el evento traiga el `uid` correcto, prohíben
antedatarlo y hacen la colección _append-only_ (nadie, ni un admin, puede editar
ni borrar un evento). Lo que **no** pueden hacer es exigir que toda escritura
venga acompañada de su evento: un cliente manipulado podría escribir sin auditar.
En la Fase 2 un trigger `onWrite` genera la auditoría del lado del servidor y esa
ventana se cierra.

### Las reglas no verifican el checklist completo

El lenguaje de reglas de Firestore no recorre arreglos, así que **no puede**
comprobar que todos los entregables obligatorios estén cumplidos antes de
avanzar un gate. Eso lo valida la máquina de dominio en el cliente. Lo que las
reglas **sí** garantizan del lado del servidor:

- la secuencia de gates (solo se avanza al inmediatamente siguiente);
- que retroceder sea exclusivo de admin y jefe de célula;
- que al avanzar, el gate que se deja atrás quede en `completado` **y** con fecha real;
- que el contratista solo vea y toque los sitios de su empresa, sin poder mover
  la fecha plan comprometida ni declarar cerrado el gate;
- que nadie se cambie su propio rol.

### Las listas están acotadas a 1.500 seguimientos

Cada documento de seguimiento lleva los 7 gates con su checklist embebidos
(~5 kB). Escuchar la colección completa significa descargar decenas de megas:
medido contra el emulador, pasar de ~2.000 documentos rompe el canal de escucha
de Firestore.

Por eso las consultas están topadas en **1.500** y, cuando se alcanza el tope, la
app lo dice («Vista parcial») en vez de mostrar un subconjunto silencioso. El
recorte natural es filtrar por programa o proyecto, que es como trabaja la PMO.
Si en algún momento un solo programa supera ese volumen, la salida es mover los
gates a una subcolección (documento padre liviano); queda anotado en
[`docs/decisiones/0002-gates-embebidos.md`](docs/decisiones/0002-gates-embebidos.md).

### El emulador y las importaciones grandes

El emulador de Firestore guarda todo en memoria. Importar 4.500 sitios sobre una
base ya sembrada puede agotarle el heap de Java. Si te pasa (verás
`OutOfMemoryError` en `firestore-debug.log`), levántalo con más memoria:

```bash
JAVA_TOOL_OPTIONS="-Xmx8g" npm run emu
```

Contra Firestore real no aplica: el límite es del emulador, no del producto.

### El selector nativo de fechas usa el idioma del navegador

Toda fecha que la app **muestra** va en formato chileno `dd-mm-aaaa`. Los campos
de edición usan el selector nativo (`<input type="date">`), cuyo formato lo define
el navegador del usuario, no la página. Por eso, junto a cada campo de fecha se
muestra además la fecha ya formateada, para que no haya ambigüedad.

---

## 7. Recorrido de aceptación

Lo que conviene probar después del seed:

1. **Dominio.** En el login, escribe un correo que no sea `@clarovtr.cl`: el botón
   queda deshabilitado. La misma regla está en el servidor (`firestore.rules`).
2. **Importación.** _Importar_ → arrastra `datos-ejemplo/sitios-ejemplo.xlsx` →
   el mapeo de columnas se autodetecta → _Validar_ → revisa la vista previa
   (marca «Ver solo filas con problemas»: aparecen el duplicado, el ID vacío, la
   coordenada no numérica y la coordenada fuera de Chile) → _Importar_.
3. **Maestro y mapa.** Filtra por programa, gate, región o proveedor; abre el
   mapa y cambia entre «colorear por gate» y «por cumplimiento».
4. **Gate bloqueado.** Abre una ficha y pulsa _Avanzar gate_ con entregables
   pendientes: el diálogo explica qué falta y no deja confirmar.
5. **Gate cumplido.** Marca los entregables (los que piden evidencia exigen una
   URL), avanza el gate y revisa la pestaña _Historial_: queda el valor anterior,
   el nuevo, quién y cuándo.
6. **Kanban.** Arrastra una tarjeta dos columnas más allá: se rechaza con
   «No se puede saltar 2 gates». Arrástrala una sola columna: pide la fecha real
   y avanza.
7. **Contratista.** Entra como `demo.contratista.alfa@clarovtr.cl`: solo ve sitios
   de Proveedor Alfa, no tiene _Importar_ ni _Auditoría_ en el menú, y puede
   marcar entregables pero no avanzar el gate.
8. **Auditoría inalterable.** En la consola del emulador, intenta editar un
   documento de `auditoria` desde la app: las reglas lo rechazan.
9. **Terreno.** Abre la ficha de un sitio en un celular (o con el viewport
   angosto) y recórrela solo con el teclado: el foco siempre es visible.
10. **Sin conexión.** Con la app abierta, corta la red (o detén el emulador): la
    barra superior avisa «Sin conexión», puedes seguir navegando lo ya cargado y
    marcar entregables; al volver la señal, los cambios suben solos.
11. **Enlace compartible.** Filtra por programa y atrasados, copia la URL, ábrela
    en otra pestaña: llega con el mismo recorte.

---

## 8. Decisiones de stack que conviene conocer

**Fechas.** Las fechas de negocio (plan/real de cada gate) se guardan como texto
`AAAA-MM-DD`, no como `Timestamp`. Un timestamp UTC se corre un día al mostrarlo
en Chile y eso ensucia todo reporte de cumplimiento. Los sellos de sistema
(`creadoEn`, auditoría) sí son instantes reales.

**Excel.** SheetJS dejó de publicarse en npm y la última versión que quedó ahí
(`xlsx@0.18.5`) arrastra un CVE de _prototype pollution_. Se usa
[`@e965/xlsx`](https://www.npmjs.com/package/@e965/xlsx), que es el build oficial
0.20.3 republicado en npm: misma API, ya corregido. Si prefieres el tarball
oficial, cambia la dependencia por
`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` y el import de
`@e965/xlsx` por `xlsx` en `src/data/archivos.ts`.

**Mapa.** Leaflet con `markercluster` y teselas de OpenStreetMap (sin API key).
Sin clustering, 4.500 marcadores dejan el mapa inservible.

**Rol en Firestore, no en claims.** Sin Cloud Functions no hay _custom claims_,
así que el rol vive en `usuarios/{uid}` y las reglas lo leen con `get()`. Cuesta
una lectura por evaluación; en la Fase 3 pasa a _custom claims_.

---

## 9. Qué viene

**Fase 2** — Gantt en SVG propio (línea base congelable, plan vs real, desviación
en días, dependencias, hitos, ruta crítica) · RAID log con escalamientos
trazados · Reporte PPT con PptxGenJS · Correo `mailto:` para crear las carpetas
de SharePoint.

**Fase 3** — Scorecard de proveedores · Carga del equipo con alerta de
sobrecarga · Dashboard ejecutivo con tendencia semanal · Cloud Functions
(auditoría en servidor, agregados nocturnos, alertas a Teams) · Login Microsoft
(Entra ID).

El modelo de datos ya contempla las tres fases: ver
[`docs/modelo-datos.md`](docs/modelo-datos.md).
