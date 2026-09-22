# Reglas de seguridad

`firestore.rules` es la **autoridad**. La matriz de `src/domain/permisos/matriz.ts`
describe lo mismo para que la interfaz no ofrezca botones que van a fallar, pero
un cliente manipulado no gana nada saltándose la matriz.

> Si cambias una regla, cámbiala en los tres lugares: `firestore.rules`,
> `src/domain/permisos/matriz.ts` y `tests/rules/`.

```bash
npm run test:rules             # 123 casos contra el emulador
npm run test:rules:conectado   # usando el emulador que ya tienes levantado
```

---

## Puerta de entrada

Toda lectura y escritura exige, sin excepción:

1. sesión autenticada;
2. correo que termine en `@clarovtr.cl` (`^[^@]+@clarovtr[.]cl$`);
3. correo **verificado** (`email_verified`);
4. perfil creado en `usuarios/{uid}`;
5. perfil con `activo == true`.

El punto 3 merece una nota: el ingreso por enlace de correo de Firebase deja
`email_verified` en `true`, y el seed crea los usuarios de prueba igual de
verificados. Si algún día se habilita el ingreso por contraseña, hay que crear
esos usuarios verificados o la regla los dejará afuera.

El sufijo no basta: `persona@noclarovtr.cl` y `persona@clarovtr.cl.evil.com` quedan
fuera (hay tests para ambos).

---

## Matriz de roles

|                               | admin | jefe_celula | analista | contratista           | lector |
| ----------------------------- | ----- | ----------- | -------- | --------------------- | ------ |
| Ver sitios y seguimiento      | todo  | todo        | todo     | **solo su proveedor** | todo   |
| Crear/editar sitios           | ✓     | ✓           | ✓        | —                     | —      |
| Importar maestro              | ✓     | ✓           | ✓        | —                     | —      |
| Avanzar gate                  | ✓     | ✓           | ✓        | —                     | —      |
| Retroceder gate               | ✓     | ✓           | —        | —                     | —      |
| Marcar checklist              | ✓     | ✓           | ✓        | **solo sus sitios**   | —      |
| Registrar fecha real          | ✓     | ✓           | ✓        | **solo sus sitios**   | —      |
| Comentar                      | ✓     | ✓           | ✓        | ✓                     | —      |
| Crear/editar tareas           | ✓     | ✓           | ✓        | —                     | —      |
| Borrar tareas                 | ✓     | ✓           | —        | —                     | —      |
| Ver auditoría                 | ✓     | ✓           | ✓        | —                     | ✓      |
| Ver portafolios/programas     | ✓     | ✓           | ✓        | —                     | ✓      |
| Editar programas y plantillas | ✓     | —           | —        | —                     | —      |
| Editar proyectos              | ✓     | ✓           | —        | —                     | —      |
| Administrar usuarios          | ✓     | —           | —        | —                     | —      |
| Borrar sitios o seguimientos  | ✓     | —           | —        | —                     | —      |
| Corrección administrativa     | ✓     | —           | —        | —                     | —      |

Cualquier rol salvo admin puede además tener un **alcance** que acota el
seguimiento a ciertas células, programas y proyectos. Ver
[Perfiles acotados](#perfiles-acotados-alcance).

«Corrección administrativa» es mover un sitio a cualquier etapa de su secuencia
(saltando hacia adelante o hacia atrás), eliminar un seguimiento completo con sus
comentarios y eliminar todos los seguimientos de un proyecto. Ver más abajo.

---

## Lo que garantizan las reglas

### Secuencia de gates

El nuevo `gateActual` solo puede ser el mismo, el inmediatamente siguiente, o el
inmediatamente anterior (y esto último solo para admin y jefe de célula). Saltar
gates se rechaza en el servidor, no solo en la interfaz. La única excepción es la
corrección administrativa del admin (abajo).

Además, **el cierre tiene que ser real**: al avanzar, el gate que se deja atrás
debe quedar con `estado == 'completado'` **y** `fechaReal != null`. Sin esta
regla se podría «avanzar» sin cerrar nada.

### Corrección administrativa (solo admin)

La app tiene que poder administrarse sin que un desarrollador toque la base. Por
eso el **admin** se salta `gateSecuencial()` y `cierreConsistente()`:

```
allow update: if puedeGestionar()
  && noCambia('sitioId') && noCambia('proyectoId')
  && noCambia('programaId') && noCambia('portafolioId')
  && ((esAdmin() && destinoValido())
      || (gateSecuencial() && cierreConsistente()));
```

- `destinoValido()` exige que el `gateActual` nuevo sea una etapa del propio
  documento o `CERRADO`: ni el admin puede mandar un sitio a una etapa inventada.
- La identidad del seguimiento (`sitioId`, `proyectoId`, `programaId`,
  `portafolioId`) sigue siendo inmutable también para el admin.
- Jefe, analista y contratista quedan exactamente como antes.

En la interfaz esto es el menú **Administrar** de la ficha del seguimiento
(`src/features/gates/AdministrarSeguimiento.tsx`), que solo ve el admin:

- **Mover a cualquier etapa**: `planCorreccionAdmin` en
  `src/domain/gates/maquina.ts`. Deja coherentes todos los gates: los anteriores
  al destino `completado` (con la fecha real que ya tenían, o la que indica el
  admin), el destino `en_curso` y los posteriores `no_iniciado` sin fecha real
  ni cierre. Recalcula `estadoGate` y `fechaPlanGateActual`. Con destino igual
  al actual sirve para reparar estados incoherentes. Motivo obligatorio.
- **Cambiar célula** (`planCambiarCelula`).
- **Eliminar seguimiento**, escribiendo el ID del sitio para confirmar.

`estadoGate` y el `estado` de cada gate **no** se editan sueltos: son derivados
(de la etapa actual y de `bloqueado`), y editarlos a mano dejaría el documento
contradiciéndose. La corrección de etapa los recalcula; el bloqueo se maneja con
Bloquear/Desbloquear.

Además, en la pantalla de importar tracker, el admin tiene **Deshacer / eliminar
seguimientos de un proyecto**: cuenta los seguimientos del proyecto, pide motivo
y el ID del proyecto, y borra en lotes de hasta 450 operaciones. No es atómico:
si se corta, lo borrado quedó borrado y auditado, y volver a ejecutarlo termina.

Todo pasa por la auditoría en el **mismo** `writeBatch`: un evento por
corrección, un evento `eliminar` por cada seguimiento borrado y, en el borrado
masivo, un evento resumen sobre el proyecto.

### Comentarios al eliminar un seguimiento

Un comentario sigue sin poder editarse ni borrarse suelto. La única excepción es
el admin eliminando el seguimiento completo:

```
allow delete: if esAdmin()
  && !existsAfter(/databases/$(database)/documents/sitioProyectos/$(spId));
```

O sea, un comentario solo se borra si su seguimiento **ya no existe después de la
escritura**: en el mismo lote que borra el padre o en uno posterior. Nadie puede
limpiar los comentarios incómodos de un sitio vivo, y eliminar un seguimiento no
deja comentarios huérfanos.

Lo que **no** se borra al eliminar un seguimiento: el sitio del maestro (puede
estar en otros proyectos) y las tareas que apuntaban a ese seguimiento
(`sitioProyectoId` queda colgando).

### Importar un tracker sin ser admin

Las plantillas (`gateTemplates`) son solo de admin, pero importar un tracker lo
pueden hacer jefe y analista. Para que no falle a medio camino:

- si la plantilla **ya existe** (re-importación), quien no es admin la reutiliza
  tal cual y la importación sigue; la pantalla avisa que se usó la existente;
- si **no existe**, la importación se detiene **antes de escribir nada**, con un
  mensaje que pide a un admin hacer la primera importación.

Re-importar sobre seguimientos existentes es una actualización, así que para
jefe y analista rige la secuencia: si el tracker mueve un sitio más de una etapa,
el lote se rechaza y la pantalla lo explica. Un admin re-importa sin esa
restricción. Los eventos de auditoría de la importación llevan `origen: 'import'`.

### Visibilidad del contratista

Solo ve `sitioProyectos` donde `proveedorId` coincide con el suyo.

Consecuencia operativa importante: Firestore evalúa las reglas **documento por
documento**, así que una consulta del contratista **debe** traer
`where('proveedorId','==',...)`. Sin ese filtro la consulta completa falla con
`permission-denied`. No es un bug: es el mecanismo. El repositorio inyecta el
filtro automáticamente según el rol (`filtroObligatorio()` en
`src/domain/permisos/matriz.ts`), y si un contratista no tuviera proveedor
asignado la función lanza un error en vez de devolver una consulta sin filtro.

El contratista tampoco puede reasignarse un sitio de otra empresa ni sacar el
suyo de su cartera.

### Perfiles acotados (alcance)

Un usuario no admin puede tener un **alcance** en su perfil
(`usuarios/{uid}.alcance`): listas de células, programas y proyectos. Si alguna
trae algo, solo ve **y** solo escribe los `sitioProyectos` (y sus comentarios)
que caen en alguna de ellas:

```
celulaId in alcance.celulas || programaId in alcance.programas || proyectoId in alcance.proyectos
```

Las tres vacías, o el campo ausente, es «sin restricción» (el comportamiento de
siempre). **Al admin nunca se le aplica**, aunque su perfil traiga listas. Al
contratista se le aplica **además** de su proveedor: ve lo de su empresa que cae
en su alcance.

En las reglas son `listaAlcance()`, `sinAlcance()` y `enAlcance(d)`:

- `get`: el documento debe estar en el alcance. Leer un id que **no existe** se
  permite (no revela nada, y el alta lo necesita para saber si el sitio ya
  estaba en el proyecto).
- `list`: igual, evaluado sobre la consulta (ver abajo).
- `create`: el documento nuevo debe quedar dentro.
- `update`: dentro **antes y después** de la escritura: un usuario acotado no
  puede sacar un seguimiento de su alcance (por ejemplo, cambiándole la célula).
  Vale también para el contratista.
- `delete`: sigue siendo solo del admin.
- `comentarios`: se mira el alcance del seguimiento padre (con `get()`) para
  leer y para comentar. `sinAlcance()` va primero, así que sin restricción no se
  paga esa lectura extra.

Quién lo asigna: **solo un admin**. El propio usuario solo puede tocar
`ultimoAcceso`, la corrección del administrador inicial no incluye `alcance`, y
el alta de un perfil exige el alcance ausente o vacío. Al guardarlo, las reglas
exigen la forma (solo las tres listas) y **30 entradas como máximo** en total.

#### Qué consulta tiene que hacer un usuario acotado

Igual que con el contratista, Firestore evalúa la regla sobre la **consulta**:
si la consulta no demuestra que todo lo que puede devolver está en el alcance,
falla completa con `permission-denied`. La forma que sí pasa es:

```
and(<igualdades>, or(where('celulaId','in',C), where('programaId','in',P), where('proyectoId','in',Q)))
```

con solo las listas no vacías. La arma `consultaVisible()` en
`src/data/repos/sitioProyectos.ts`, por la que pasan **todas** las consultas de
la colección (la tabla, el mapa, el kanban, la ficha del sitio y la reescritura
de datos del sitio).

Hay una sutileza, probada contra el emulador: Firestore reparte la consulta en
disyunciones y evalúa la regla sobre cada una. Si el usuario filtra por
`programaId == 'p1'` y el `or()` trae `programaId in ['p2']`, esa disyunción
(«programa p1 **y** programa p2») no devuelve nada, pero la regla no puede
probarla y rechaza la consulta **entera**. Por eso el `or()` se ajusta a las
igualdades (`planAlcance()` en `src/domain/permisos/alcance.ts`):

- si el usuario fijó un campo con un valor que **está** en su lista, esa
  igualdad sola prueba el alcance y no va `or()`;
- si el valor **no está**, esa disyunción se quita;
- si no queda ninguna, no hay nada visible y ni siquiera se consulta.

El tope de 30 entradas no es arbitrario: un `or()` admite 30 disyunciones como
máximo y un `in`, 30 valores. Como el resto de los filtros son igualdades, la
consulta combinada nunca pasa de 30 disyunciones. Todo son igualdades sin
`orderBy`, así que no hace falta ningún índice compuesto.

#### Lo que el alcance NO acota

El alcance restringe **solo** `sitioProyectos` y sus comentarios. Un usuario
acotado sigue viendo el maestro de `sitios`, las `tareas`, la `auditoria`, los
catálogos y el RAID como cualquiera de su rol. Además, al editar un sitio del
maestro solo se reescribe la copia desnormalizada de los seguimientos de su
alcance; los demás conservan la copia vieja hasta que alguien sin restricción
vuelva a guardar el sitio.

### El contratista reporta, no aprueba

Puede marcar entregables y registrar la fecha real de su gate en curso, pero las
reglas le impiden cambiar `gateActual`, `estadoGate`, `bloqueado`, `prioridad`,
`responsableUid`, y —en el gate en curso— el `estado`, la `fechaPlan`
comprometida y `completadoPor`.

### Auditoría inalterable

- `create` solo con el `uid` y el `email` del propio token.
- `ts` debe ser `request.time`, o sea `serverTimestamp()`: no se puede antedatar.
- `update` y `delete` denegados **a todos**, incluido admin.

### Escalamiento de privilegios

- Al darse de alta, un usuario nuevo solo puede crearse a sí mismo, con rol
  `lector` y sin proveedor.
- Nadie puede modificar su propio rol, **salvo** los correos de
  `correosAdministradores()`, que pueden fijar el suyo en `admin` (ver abajo).
- Un admin no puede quitarse a sí mismo el rol de admin (dejaría la instalación
  sin administrador y sin forma de volver).
- Un contratista no puede quedar sin proveedor.
- Nadie se asigna ni se quita su propio alcance: lo asigna un admin.
- Los usuarios no se borran: se desactivan, para que su rastro en la auditoría
  siga apuntando a alguien.

### El arranque

Una instalación nueva no tiene a nadie: la base está vacía, no hay perfiles y la
promoción de roles es cosa de un admin. Alguien tiene que entrar primero, y puede
no tener cuenta corporativa.

Para eso existe `correosAdministradores()` en las reglas, una lista corta de
correos que además entran como `admin`. Su espejo en el cliente es la variable
`VITE_CORREOS_ADMIN`, pero **la lista de las reglas es la que manda**: agregar un
correo solo en el cliente no autoriza a nadie, la persona entra y no puede leer
nada.

Las reglas le conceden dos cosas, y nada más:

1. Crear su propio perfil con `rol == 'admin'` en el primer ingreso.
2. Corregir **su propio** rol a `admin` si el perfil ya existe con un rol menor.

El segundo permiso no es redundante. Basta que el primer ingreso ocurra con un
cliente desplegado antes de agregar el correo a `VITE_CORREOS_ADMIN` para que el
perfil quede como `lector`, y desde ahí no hay salida: promover es cosa de un
admin y no hay ninguno. Sin ese permiso la única reparación es editar el
documento a mano en la consola de Firebase.

Está acotado: el cambio solo puede tocar `rol`, `ultimoAcceso`, `actualizadoEn` y
`actualizadoPor`; solo sobre el propio documento; y solo para los correos de la
lista. Un corporativo cualquiera no puede ascenderse, y quien está en la lista no
puede ascender a un tercero por esta vía (sí como admin, una vez que lo es).

Cuando exista un admin corporativo estable, lo correcto es vaciar la lista en
`firestore.rules` y en `VITE_CORREOS_ADMIN`, y volver a desplegar.

### Todo lo demás, cerrado

La última regla es `match /{documento=**} { allow read, write: if false; }`. Una
colección nueva no queda accesible por olvido.

---

## Lo que las reglas NO garantizan (Fase 1)

### El checklist completo antes de avanzar

El lenguaje de reglas no recorre arreglos, así que no puede comprobar que todos
los entregables obligatorios de un gate estén cumplidos. Esa validación vive en
`domain/gates/maquina.ts` y corre en el cliente.

Lo que sí queda cubierto en el servidor es que el gate anterior quede
`completado` con fecha real, más toda la secuencia y los permisos. En la Fase 2,
una Cloud Function valida el checklist del lado del servidor.

### Que toda escritura traiga su auditoría

Las reglas verifican cada evento de auditoría que llega, pero no pueden exigir
que un cambio venga acompañado del suyo. La app los escribe siempre en el mismo
`writeBatch` (atómico), pero un cliente manipulado podría escribir sin auditar.
En la Fase 2 un trigger `onWrite` genera la auditoría en el servidor.

---

## Costo de las reglas

Cada evaluación hace un `get()` a `usuarios/{uid}` para leer el rol, y eso es una
lectura facturable. Firestore cachea el mismo documento dentro de una misma
evaluación, así que es una por operación, no una por función.

Sin Cloud Functions no hay alternativa (los _custom claims_ se asignan desde el
Admin SDK). En la Fase 3, el rol pasa a ser un claim del token y estas lecturas
desaparecen.

---

## Qué cubren los tests

`tests/rules/` — 123 casos contra el emulador:

- **`acceso.test.ts`** — dominio, correo sin verificar, usuario sin perfil,
  usuario desactivado, permisos por rol sobre sitios, catálogos y tareas, y que
  una colección no declarada quede cerrada.
- **`gates.test.ts`** — avance, saltos de gate, gate inexistente, avance sin
  cerrar el origen, retroceso por rol, cierre del último gate, campos de
  identidad inmutables, visibilidad del contratista (incluida la consulta sin
  filtro y la consulta suplantando a otro proveedor), lo que el contratista
  puede y no puede escribir, los comentarios, y la corrección administrativa:
  el admin salta etapas en ambos sentidos pero no a una etapa inexistente ni
  cambiando la identidad; jefe, analista y contratista siguen sin poder saltar;
  solo el admin elimina, y los comentarios solo se borran con el padre eliminado.
- **`auditoria.test.ts`** — append-only, antedatado, suplantación, y todos los
  casos de escalamiento de privilegios sobre `usuarios`.
- **`alcance.test.ts`** — perfiles acotados: la consulta con el `or()` del
  alcance pasa y sin él falla; una igualdad sola no alcanza; igualdades más el
  `or()` ajustado pasan, y el `or()` completo contradicho por una igualdad falla
  (la razón de `planAlcance()`); un alcance de 30 entradas sigue siendo
  consultable; no se lee, edita, crea ni comenta fuera del alcance; no se puede
  sacar un seguimiento del alcance; contratista con proveedor y alcance; admin y
  alcance vacío sin restricción; nadie se asigna su propio alcance, el alta no lo
  trae, y el admin no pasa del tope ni guarda una forma rara.
