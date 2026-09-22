# Reglas de seguridad

`firestore.rules` es la **autoridad**. La matriz de `src/domain/permisos/matriz.ts`
describe lo mismo para que la interfaz no ofrezca botones que van a fallar, pero
un cliente manipulado no gana nada saltándose la matriz.

> Si cambias una regla, cámbiala en los tres lugares: `firestore.rules`,
> `src/domain/permisos/matriz.ts` y `tests/rules/`.

```bash
npm run test:rules             # 62 casos contra el emulador
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

---

## Lo que garantizan las reglas

### Secuencia de gates

El nuevo `gateActual` solo puede ser el mismo, el inmediatamente siguiente, o el
inmediatamente anterior (y esto último solo para admin y jefe de célula). Saltar
gates se rechaza en el servidor, no solo en la interfaz.

Además, **el cierre tiene que ser real**: al avanzar, el gate que se deja atrás
debe quedar con `estado == 'completado'` **y** `fechaReal != null`. Sin esta
regla se podría «avanzar» sin cerrar nada.

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
- Nadie puede modificar su propio rol.
- Un admin no puede quitarse a sí mismo el rol de admin (dejaría la instalación
  sin administrador y sin forma de volver).
- Un contratista no puede quedar sin proveedor.
- Los usuarios no se borran: se desactivan, para que su rastro en la auditoría
  siga apuntando a alguien.

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

`tests/rules/` — 62 casos contra el emulador:

- **`acceso.test.ts`** — dominio, correo sin verificar, usuario sin perfil,
  usuario desactivado, permisos por rol sobre sitios, catálogos y tareas, y que
  una colección no declarada quede cerrada.
- **`gates.test.ts`** — avance, saltos de gate, gate inexistente, avance sin
  cerrar el origen, retroceso por rol, cierre del último gate, campos de
  identidad inmutables, visibilidad del contratista (incluida la consulta sin
  filtro y la consulta suplantando a otro proveedor), lo que el contratista
  puede y no puede escribir, y los comentarios.
- **`auditoria.test.ts`** — append-only, antedatado, suplantación, y todos los
  casos de escalamiento de privilegios sobre `usuarios`.
