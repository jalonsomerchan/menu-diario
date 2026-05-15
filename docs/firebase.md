# Firebase para Menu Diario

Esta webapp usa Firebase Auth y Firestore desde el navegador. Las variables `PUBLIC_FIREBASE_*` son públicas y deben protegerse con reglas de seguridad correctas.

## Servicios necesarios

Activa en Firebase Console:

- Authentication: Google y Anonymous.
- Firestore Database.
- Authorized domains: el dominio donde se despliegue la webapp.

## Error `Missing or insufficient permissions`

Si al iniciar sesión aparece `Missing or insufficient permissions`, normalmente la autenticación sí ha funcionado, pero Firestore ha rechazado la lectura o escritura posterior.

Para solucionarlo, publica las reglas del fichero `firestore.rules` en Firebase Console:

```txt
Firebase Console > Firestore Database > Rules
```

Después pulsa **Publish**. La app necesita permiso para:

- Crear o actualizar `users/{uid}` del usuario autenticado.
- Guardar preferencias personales como `enabledMeals`, `theme` y `groupId`.
- Crear y actualizar `groups/{groupId}`.
- Añadirse como miembro de un grupo cuando conoce el código de invitación.
- Crear un `weeklyMenus/{menuId}` propio.
- Leer menús estando autenticado, porque el histórico y los códigos usan consultas cliente.
- Editar o borrar días de menús donde el usuario sea miembro.
- Crear y actualizar platos reutilizables en `dishes` para sugerencias y estadísticas.

## Colecciones

### `users/{userId}`

Perfil mínimo y preferencias del usuario autenticado.

```json
{
  "displayName": "Jorge",
  "email": "jorge@example.com",
  "enabledMeals": ["breakfast", "lunch", "dinner"],
  "theme": "system",
  "groupId": "group-id",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

`enabledMeals` puede incluir `breakfast`, `lunch` y `dinner`. `theme` puede ser `system`, `light` o `dark`.

### `groups/{groupId}`

Grupo de convivencia o planificación. Permite ver miembros, emails pendientes y opciones compartidas.

```json
{
  "name": "Menu Diario",
  "ownerId": "uid",
  "members": ["uid"],
  "memberEmails": ["jorge@example.com"],
  "pendingEmails": ["otra-persona@example.com"],
  "inviteCode": "ABC123",
  "enabledMeals": ["lunch"],
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

La invitación por email no envía correo desde la app. Guarda el email como pendiente y muestra el código para compartirlo manualmente. La otra persona se une escribiendo ese código en **Ajustes**.

Si un usuario sale de un grupo, se elimina de `members` y se le crea o asigna un grupo propio para que no se quede sin configuración.

### `weeklyMenus/{menuId}`

Menú compartido. Cada día permite desayuno, comida y cena, y cada bloque permite varios platos. También puede marcarse el día completo como no configurable, guardando motivo y nota.

```json
{
  "title": "13 may - 19 may",
  "ownerId": "uid",
  "members": ["uid"],
  "inviteCode": "ABC123",
  "weekStart": "2026-05-11",
  "days": {
    "2026-05-11": {
      "skipped": false,
      "reason": "",
      "skipNote": "",
      "meals": {
        "breakfast": {
          "items": ["Café", "Tostada"],
          "skipped": false,
          "reason": "",
          "note": ""
        },
        "lunch": {
          "items": ["Lentejas", "Ensalada"],
          "skipped": false,
          "reason": "",
          "note": ""
        },
        "dinner": {
          "items": [],
          "skipped": true,
          "reason": "eating-out",
          "note": "Cena fuera"
        }
      },
      "notes": "Comprar pan"
    }
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "updatedBy": "uid"
}
```

Cuando `days.{fecha}.skipped` es `true`, la interfaz oculta platos y notas del día y muestra `reason` y `skipNote`. Los campos `meals.*.skipped` se mantienen para compatibilidad y para posibles saltos por comida concreta.

El histórico reutiliza estos documentos buscando menús donde el usuario es miembro y mostrando los días anteriores del rango seleccionado.

### `dishes/{dishId}`

Catálogo de platos reutilizables. Se alimenta automáticamente cuando se añaden platos a un día y también permite crear platos manualmente desde **Mis platos** aunque todavía no se hayan comido.

```json
{
  "name": "Lentejas",
  "normalizedName": "lentejas",
  "createdBy": "uid",
  "members": ["uid"],
  "timesUsed": 3,
  "favorite": true,
  "blocked": false,
  "tags": ["legumbre"],
  "quickTags": ["cheap", "healthy", "batch-cooking"],
  "archived": false,
  "createdAt": "serverTimestamp",
  "lastUsedAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

`normalizedName` se usa para evitar duplicados por mayúsculas, acentos o espacios repetidos. Los platos creados manualmente empiezan con `timesUsed: 0` y sin `lastUsedAt`. Archivar un plato cambia `archived` a `true`; no borra ni modifica menús históricos que ya guarden ese nombre en `weeklyMenus.days.*.meals.*.items`.

`favorite` prioriza el plato en listados y sugerencias. `blocked` evita que el plato aparezca como sugerencia automática, aunque el usuario puede escribirlo manualmente en un menú. `quickTags` guarda etiquetas rápidas configuradas en `src/data/dish-tags.ts`: `quick`, `cheap`, `healthy`, `vegetarian`, `treat`, `kids`, `batch-cooking` y `freezable`. Las etiquetas visibles están traducidas en `src/i18n/translations/*.json`.

`tags` queda preparado para futuras integraciones con recetas, sugerencias, lista de la compra y estadísticas avanzadas. La primera versión solo muestra etiquetas si ya existen en Firestore.

## Reglas incluidas

La fuente de verdad está en `firestore.rules`. Copia ese fichero en Firestore Rules si configuras el proyecto desde Firebase Console.

Las reglas actuales permiten a usuarios autenticados actualizar sus documentos de `dishes` siempre que sean miembros del documento. Los campos `favorite`, `blocked`, `quickTags` y `archived` no eliminan referencias históricas porque los menús guardan los nombres de los platos dentro de `weeklyMenus`.

## Índices

Firestore puede pedir crear índices para estas consultas:

```txt
weeklyMenus
  members array-contains
  weekStart desc
```

La lista de platos reutilizables usa `createdBy == uid` y se ordena en el navegador por favoritos, bloqueados, etiquetas, `timesUsed`, `lastUsedAt`, `createdAt` o `name`, así que no necesita índices compuestos nuevos.

La consulta por código de grupo usa `inviteCode ==`, que normalmente no necesita índice compuesto.

## Notificaciones

La app usa notificaciones del navegador cuando un documento escuchado en tiempo real cambia y el cambio lo hace otro usuario. No usa Firebase Cloud Messaging todavía, por lo que no envía push si el navegador no tiene la app abierta o cargada en segundo plano.

## Seguridad pendiente para producción

Estas reglas están pensadas para que la app funcione en una primera versión cliente-only. Para producción conviene endurecerlas:

- Mover la unión por código a una Cloud Function para reducir `allow read: if signedIn()` en `weeklyMenus` y `groups`.
- Enviar invitaciones reales por email desde backend o Cloud Functions.
- Validar longitudes máximas de `meals.*.items`, `meals.*.note`, `notes`, `skipNote`, `title`, `inviteCode`, `name`, `memberEmails`, `pendingEmails`, `quickTags` y `tags`.
- Impedir que usuarios no propietarios cambien `ownerId` o eliminen miembros arbitrariamente.
- Usar códigos de invitación más largos o con caducidad.
